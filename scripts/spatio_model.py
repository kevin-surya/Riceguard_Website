"""Reconstructed regularized BYM2-style spatial/AR(1) hurdle model.

This is a new MAP implementation, not the unavailable original fitted model.
All model selection uses 2007-2011 validation; 2012-2021 stays held out.
"""
import numpy as np
from scipy import sparse
from scipy.sparse.linalg import splu
from scipy.special import expit

PHI=.5

def spatial_precision(active):
 coordinates=np.argwhere(active);indices={tuple(point):i for i,point in enumerate(coordinates)};n=len(coordinates);adj=np.zeros((n,n))
 for i,(row,col) in enumerate(coordinates):
  for neighbour in [(row-1,col),(row+1,col),(row,col-1),(row,col+1)]:
   if neighbour in indices:adj[i,indices[neighbour]]=1
 # Proper-CAR regularization handles disconnected islands. Scale average marginal variance.
 q=np.diag(adj.sum(axis=1))-adj+.05*np.eye(n);cov=np.linalg.inv(q);scale=np.exp(np.mean(np.log(np.diag(cov))));q*=scale
 return sparse.csc_matrix(q),np.diag(cov)/scale,coordinates

def temporal_precision(t,rho):
 if t==1:return sparse.eye(1,format='csc')
 diagonal=np.full(t,1+rho*rho);diagonal[[0,-1]]=1
 return sparse.diags([-rho*np.ones(t-1),diagonal,-rho*np.ones(t-1)],[-1,0,1],format='csc')/(1-rho*rho)

def features(years,rain,center=None):
 lograin=np.log1p(rain)
 if center is None:center={'rain_mean':float(np.mean(lograin)),'rain_sd':float(max(np.std(lograin),.1)),'year_mean':float(np.mean(years)),'year_sd':float(max(np.std(years),1))}
 time=np.broadcast_to((np.asarray(years)[:,None]-center['year_mean'])/center['year_sd'],rain.shape)
 x=np.stack([np.ones_like(rain),(lograin-center['rain_mean'])/center['rain_sd'],time],axis=-1)
 return x.reshape(-1,3),center

def fit(area,rain,years,qspace,rho,lam,binary=False):
 t,n=area.shape;x,center=features(years,rain);m=t*n;identity=sparse.eye(m,format='csc')
 design=sparse.hstack([sparse.csc_matrix(x),np.sqrt(PHI)*identity,np.sqrt(1-PHI)*identity],format='csc')
 qt=temporal_precision(t,rho);prior=sparse.block_diag([sparse.diags([1e-6,.2,.2]),lam*sparse.kron(qt,qspace),lam*sparse.kron(qt,sparse.eye(n))],format='csc')
 present=area.ravel()>0
 if binary:
  y=present.astype(float);coef=np.zeros(design.shape[1]);coef[0]=np.log((y.mean()+.01)/(1-y.mean()+.01))
  for iteration in range(30):
   eta=design@coef;p=expit(np.clip(eta,-25,25));w=np.maximum(p*(1-p),1e-5);z=eta+(y-p)/w
   hessian=design.T@design.multiply(w[:,None])+prior;factor=splu(hessian.tocsc());new=factor.solve(np.asarray(design.T@(w*z)).ravel())
   if np.max(np.abs(new-coef))<1e-5:coef=new;break
   coef=new
  sigma2=0
 else:
  observed=design[present];y=np.log(area.ravel()[present]);hessian=observed.T@observed+prior;factor=splu(hessian.tocsc());coef=factor.solve(np.asarray(observed.T@y).ravel());sigma2=float(np.mean((y-observed@coef)**2))
 return {'coef':coef,'factor':factor,'center':center,'rho':rho,'lam':lam,'sigma2':sigma2,'t':t,'n':n,'last_year':int(years[-1]),'binary':binary}

def predict(model,years,rain,uncertainty=False,spatial_variance=None):
 n,t=model['n'],model['t'];p=3;coef=model['coef'];last=np.sqrt(PHI)*coef[p+(t-1)*n:p+t*n]+np.sqrt(1-PHI)*coef[p+t*n+(t-1)*n:p+2*t*n]
 x,_=features(years,rain,model['center']);x=x.reshape(len(years),n,3);h=np.asarray(years)-model['last_year'];decay=model['rho']**h
 mu=x@coef[:p]+decay[:,None]*last
 if model['binary']:return expit(mu)
 point=np.exp(np.clip(mu+model['sigma2']/2,-30,30))
 if not uncertainty:return point
 basis=np.zeros((len(coef),p+n));basis[:p,:p]=np.eye(p)
 for i in range(n):basis[p+(t-1)*n+i,p+i]=np.sqrt(PHI);basis[p+t*n+(t-1)*n+i,p+i]=np.sqrt(1-PHI)
 covariance=(basis.T@model['factor'].solve(basis))*model['sigma2'];beta=covariance[:p,:p];cross=covariance[:p,p:];latent=np.diag(covariance[p:,p:]);variances=[]
 for index,d in enumerate(decay):
  fixed=np.einsum('ij,jk,ik->i',x[index],beta,x[index]);lastvar=d*d*latent+2*d*np.einsum('ij,ji->i',x[index],cross)
  innovation=model['sigma2']*(1-d*d)/model['lam']*(PHI*spatial_variance+(1-PHI))
  variances.append(np.maximum(0,fixed+lastvar+innovation)+model['sigma2'])
 sd=np.sqrt(variances)
 return point,np.exp(np.clip(mu-1.96*sd,-30,30)),np.exp(np.clip(mu+1.96*sd,-30,30))

def errors(actual,predicted):
 residual=actual-predicted;sst=np.sum((actual-actual.mean())**2)
 return {'r2':float(1-np.sum(residual**2)/sst),'mae_ha':float(np.mean(np.abs(residual))),'rmse_ha':float(np.sqrt(np.mean(residual**2))),'bias_actual_minus_pred_ha':float(residual.mean()),'n_test':int(actual.size)}
