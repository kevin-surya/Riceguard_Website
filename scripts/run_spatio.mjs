import {existsSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const steps={download:['recover_glorice_source.py','download_spatio_covariates.py'],prepare:['prepare_spatio_inputs.py'],train:['build_spatio_timeline.py'],render:['render_spatio_rasters.py'],notebook:['rerun_spatio_notebook.py']};
const action=process.argv[2];if(!steps[action])throw new Error('Use download, prepare, train, render, or notebook.');
const python=path.join('.venv-spatio',process.platform==='win32'?'Scripts':'bin',process.platform==='win32'?'python.exe':'python');
if(action!=='download'&&!existsSync(python))throw new Error('Create .venv-spatio and install requirements-spatio.txt first.');
for(const script of steps[action]){const result=spawnSync(existsSync(python)?python:'python',[path.join('scripts',script)],{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
