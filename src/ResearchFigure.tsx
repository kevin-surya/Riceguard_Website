import { t } from './i18n';
import { countries } from './model.mjs';

type Figure = { name: string; path: string; title: string };
type Annotation = { x: number; y: number; width: number; height: number; key: string; angle?: number; size?: number; background?: string };
const background = '#ebf2f5';
const layouts: Record<string, {width:number;height:number;annotations:Annotation[]}> = {
  historical: {width:1607,height:648,annotations:[
    {x:70,y:0,width:669,height:28,key:'Historical GloRice harvested area · 1961',size:18},
    {x:780,y:0,width:669,height:28,key:'Historical GloRice harvested area · 2021',size:18},
    {x:200,y:617,width:400,height:28,key:'Longitude'}, {x:915,y:617,width:400,height:28,key:'Longitude'},
    {x:4,y:240,width:25,height:145,key:'Latitude',angle:-90}, {x:747,y:240,width:25,height:145,key:'Latitude',angle:-90},
    {x:1580,y:68,width:27,height:485,key:'Harvested area (ha; log scale)',angle:-90},
  ]},
  'fine-2030': {width:1507,height:596,annotations:[
    {x:70,y:0,width:607,height:28,key:'GloRice pattern allocation · 2030 · SSP2-4.5',size:17},
    {x:751,y:0,width:607,height:28,key:'GloRice pattern allocation · 2030 · SSP5-8.5',size:17},
    {x:180,y:566,width:400,height:28,key:'Longitude'},{x:850,y:566,width:400,height:28,key:'Longitude'},
    {x:4,y:210,width:25,height:140,key:'Latitude',angle:-90},{x:686,y:210,width:25,height:140,key:'Latitude',angle:-90},
    {x:1470,y:82,width:35,height:430,key:'Allocated harvested area (ha; log scale)',angle:-90},
  ]},
  uncertainty:{width:1610,height:511,annotations:[
    {x:70,y:0,width:395,height:28,key:'Projected harvested area · SSP2-4.5',size:16},
    {x:535,y:0,width:395,height:28,key:'Projected harvested area · SSP5-8.5',size:16},
    {x:1116,y:0,width:395,height:28,key:'Conditional interval width · SSP2-4.5',size:16},
    {x:150,y:481,width:240,height:28,key:'Column (2° grid)'},{x:610,y:481,width:240,height:28,key:'Column (2° grid)'},{x:1190,y:481,width:240,height:28,key:'Column (2° grid)'},
    {x:4,y:140,width:25,height:230,key:'Row (2° grid)',angle:-90},{x:468,y:140,width:25,height:230,key:'Row (2° grid)',angle:-90},{x:1050,y:140,width:25,height:230,key:'Row (2° grid)',angle:-90},
    {x:1022,y:72,width:30,height:348,key:'Harvested area (ha; log scale)',angle:-90},{x:1580,y:72,width:30,height:348,key:'Interval width (ha; log scale)',angle:-90},
  ]},
  country:{width:880,height:469,annotations:[
    {x:96,y:0,width:775,height:28,key:'2030 harvested area by country',size:17},
    {x:220,y:437,width:520,height:30,key:'Harvested area (ha)'},
    {x:110,y:343,width:90,height:18,key:'Skenario',size:12,background:'#fafafa'},
    ...['THA','MMR','KHM','IDN','VNM','LAO','PHL','MYS','BRN','SGP'].map((code,index)=>({x:0,y:38+index*38.5,width:92,height:27,key:countries.find(c=>c.code===code)!.name,size:13})),
  ]},
};

/** Translate plot annotations in SVG; keep the supplied scientific raster pixels intact. */
export default function ResearchFigure({ figure }: {figure:Figure}) {
  const layout=layouts[figure.name];
  return <span className="translated-figure"><img src={figure.path} alt={t(figure.title)}/>{layout&&<svg className="figure-annotations" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">{layout.annotations.map((box,index)=>{
    const text=t(box.key);const cx=box.x+box.width/2,cy=box.y+box.height/2;
    const space=box.angle?box.height:box.width;
    const size=Math.min(box.size||14,space/Math.max(text.length*.6,1));
    return <g key={index}><rect x={box.x} y={box.y} width={box.width} height={box.height} fill={box.background||background}/><text x={cx} y={cy} dominantBaseline="central" textAnchor="middle" transform={box.angle?`rotate(${box.angle} ${cx} ${cy})`:undefined} fontSize={size} fill="#161d20">{text}</text></g>;
  })}</svg>}</span>;
}
