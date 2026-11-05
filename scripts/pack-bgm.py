#!/usr/bin/env python3
"""Pack the user's BGM (made with Gemini) into data/bgm_<id>.js for KSAudio, prepared as seamless loops.
usage: pack-bgm.py <src_dir with the original mp3s> <repo_dir> <seam preview .m4a>

Each track ends in a fade-out, so it loops internally: after the intro the player jumps from loopEnd back to loopStart.
Loop points come from find-bgm-loops.py (self-similarity of 0.1 s log-band spectra, then onset alignment; the lengths
land on whole bars, e.g. 144.0 s = 48 bars at 80 bpm). The musical crossfade is baked into the file here, sample-exact:
the last XF seconds before loopEnd are mixed (equal-power, corrected for the correlation of the two passages) into the
music before loopStart, so the audio just before loopEnd already IS the audio just before loopStart, and a jump
loopEnd -> loopStart is continuous. The file then carries TAIL seconds of the music after loopStart past loopEnd, so the
player can splice the two identical passages anywhere in that window with a short crossfade. Leading digital silence
is trimmed; the fade-out ending is dropped (track changes crossfade in the player)."""
import base64,json,os,subprocess,sys,tempfile,numpy as np
SRC,REPO,PREV=sys.argv[1],sys.argv[2],sys.argv[3]
SR=44100;TAIL=1.5
CREDIT={'credit':'Gemini で制作（プレイヤー提供）','url':None}
# id, source, title, loopStart (s, source time), loop length (s), baked crossfade (s): 1 s for rhythmic, longer for ambient pads
TRACKS=[('front','the_iron_front','The Iron Front',65.7357,96.0,1.0),
 ('vanguard','the_iron_vanguard','The Iron Vanguard',18.9243,144.0,1.0),
 ('gilded','siege_of_the_gilded_star','Siege of the Gilded Star',40.4492,121.0,1.0),
 ('colossus','siege_of_the_colossus','Siege of the Colossus',31.8578,140.8,1.0),
 ('sovereign','sovereign_siege','Sovereign Siege',78.8782,87.0,1.0),
 ('starlight','path_through_the_starlight','Path Through the Starlight',72.4463,94.30,3.0),
 ('launch','waiting_for_launch','Waiting for Launch',9.0558,144.0,2.0),
 ('meridian','stellar_meridian','Stellar Meridian',78.0423,72.0,2.0),
 ('heavens','when_the_heavens_break','When the Heavens Break',87.4696,75.63,3.0),
 ('drift','where_the_stars_drift','Where the Stars Drift',59.6288,96.0,2.0),
 ('periphery','charting_the_gilded_periphery','Charting the Gilded Periphery',83.1274,64.0,1.0)]
def dec(p):
    b=subprocess.run(['ffmpeg','-v','error','-i',p,'-ac','2','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(b,np.float32).reshape(-1,2).astype(np.float64)
def enc(y,out):
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','-','-c:a','aac','-b:a','80k','-movflags','+faststart',out],input=y.astype(np.float32).tobytes(),check=True)
prev=[]
for tid,src,title,S0,LEN,XF in TRACKS:
    x=dec(os.path.join(SRC,src+'.mp3'))
    # trim leading digital silence (< -60 dBFS in 10 ms blocks), keep 30 ms
    m=np.abs(x).max(1);blk=441;nb=len(m)//blk;pk=m[:nb*blk].reshape(nb,blk).max(1);first=int(np.argmax(pk>1e-3));cut=max(0,first*blk-int(.03*SR))
    s=int(round(S0*SR))-cut;l=s+int(round(LEN*SR));n=int(XF*SR);x=x[cut:]
    y=np.concatenate([x[:l],x[s:s+int(TAIL*SR)]]).copy()
    a=x[l-n:l];b=x[s-n:s];rho=float(np.clip(np.sum(a*b)/np.sqrt(np.sum(a*a)*np.sum(b*b)+1e-12),0,1))
    th=np.linspace(0,np.pi/2,n,endpoint=False)[:,None];go,gi=np.cos(th),np.sin(th);norm=1/np.sqrt(1+2*rho*go*gi)
    y[l-n:l]=(a*go+b*gi)*norm
    f=int(.02*SR);y[-f:]*=np.linspace(1,0,f)[:,None]
    pk=np.abs(y).max()
    if pk>0.999:y*=0.999/pk
    with tempfile.TemporaryDirectory() as td:
        m4a=os.path.join(td,tid+'.m4a');enc(y,m4a)
        d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',m4a],capture_output=True,text=True,check=True).stdout.strip())
        b64=base64.b64encode(open(m4a,'rb').read()).decode('ascii')
    LS,LE=s/SR,l/SR
    meta={'id':tid,'title':title,'mime':'audio/mp4','dur':round(d,2),'loop':[round(LS,4),round(LE,4)],**CREDIT}
    js='// '+title+' — '+CREDIT['credit']+'. Loops '+('%.2f'%LS)+' s -> '+('%.2f'%LE)+' s (seam baked in; see docs/audio.md).\n(self.KSBGM=self.KSBGM||{})['+json.dumps(tid)+']=Object.assign('+json.dumps(meta,ensure_ascii=False)+',{b64:"'+b64+'"});\n'
    p=os.path.join(REPO,'data','bgm_'+tid+'.js');open(p,'w',encoding='utf-8').write(js)
    print(tid,'cut %.3f'%(cut/SR),'loop %.3f-%.3f'%(LS,LE),'rho %.2f'%rho,'dur',round(d,2),os.path.getsize(p),flush=True)
    # preview: 7 s before the loop end, then (jump) 7 s from the loop start, as the player will play it
    prev.append(np.concatenate([y[l-7*SR:l],x[s:s+7*SR],np.zeros((SR,2))]))
enc(np.concatenate(prev)*0.9,PREV)
