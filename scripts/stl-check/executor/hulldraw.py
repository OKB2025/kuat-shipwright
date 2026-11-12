import numpy as np,json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image,ImageDraw
import hullfit as hf
xs=[int(v) for v in sys.argv[1].split(',')];tiles=[]
for x in xs:
    H=hf.sect(hf.Hh,x,hf.bb);O=hf.sect(hf.E,x,hf.bb);C=hf.casings(x)
    W,Hh=900,300;sc=W/6800;img=Image.new('RGB',(W,Hh+20),'white');d=ImageDraw.Draw(img)
    tx=lambda z,y:((z+3400)*sc,Hh-(y+50)*sc*1.0)
    def draw(g,fill,outline):
        for p in (g.geoms if hasattr(g,'geoms') else [g]):
            if p.is_empty or p.geom_type!='Polygon':continue
            d.polygon([tx(*c) for c in p.exterior.coords],fill=fill,outline=outline)
            for h in p.interiors:d.polygon([tx(*c) for c in h.coords],fill='white')
    draw(O,(170,170,170),None);draw(C,None,(0,160,0));
    for p in (H.geoms if hasattr(H,'geoms') else [H]):
        if p.geom_type=='Polygon':d.line([tx(*c) for c in p.exterior.coords],fill=(220,0,0),width=2)
    d.text((5,Hh+5),f'x={x} m  grey=original  red=hull (before trench/cuts)  green=engine spaces',fill='black');tiles.append(img)
sheet=Image.new('RGB',(900,sum(t.height for t in tiles)),'white');y=0
for t in tiles:sheet.paste(t,(0,y));y+=t.height
sheet.save(SP+'hullfit.png')
