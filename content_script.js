let keyCatInited=false;
let keyCount=0;
let digitScrolls=[];
let curDigits=[];
const unitHeight=40;

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
}else{
    init();
}

function init(){
    if(keyCatInited) return;
    keyCatInited=true;

    const host=document.createElement('div');
    host.style.position='fixed';
    host.style.bottom='10px';
    host.style.right='10px';
    host.style.zIndex='10000';
    host.style.pointerEvents='none';
    document.body.appendChild(host);

    const shadow=host.attachShadow({mode:'open'});

    const fontLink=document.createElement('link');
    fontLink.rel='stylesheet';
    fontLink.href='https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Roboto+Mono:wght@400;700&display=swap';
    shadow.appendChild(fontLink);

    const style=document.createElement('style');
    style.textContent=`
    :host,#keyTapCounter,.digit,.digit-container,.digit-scroll,*{
        font-family:'JetBrains Mono','Roboto Mono','Space Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace !important;
        font-variant-numeric:tabular-nums lining-nums !important;
        -webkit-font-smoothing:antialiased;
        -moz-osx-font-smoothing:grayscale;
        text-rendering:optimizeLegibility;
    }
    .wrapper{display:flex;flex-direction:column;align-items:center;pointer-events:none;}
    #keyTapCounter{display:inline-flex;align-items:center;gap:2px;font-size:32px;height:${unitHeight}px;user-select:none;color:black;}
    .digit-container{position:relative;display:inline-block;width:22px;height:${unitHeight}px;overflow:hidden;vertical-align:top;text-align:center;}
    .digit-scroll{position:absolute;top:0;left:0;width:100%;transition:top 0.28s cubic-bezier(.21,.8,.35,1);will-change:top;}
    .digit{height:${unitHeight}px;line-height:${unitHeight}px;font-weight:600;text-align:center;}
    img{width:100px;height:auto;pointer-events:none;display:none;}
    `;
    shadow.appendChild(style);

    const wrapper=document.createElement('div');
    wrapper.className='wrapper';
    shadow.appendChild(wrapper);

    const catImg=document.createElement('img');
    catImg.src=chrome.runtime.getURL('cat.png');
    wrapper.appendChild(catImg);

    const countDisplay=document.createElement('div');
    countDisplay.id='keyTapCounter';
    countDisplay.style.marginTop='5px';
    wrapper.appendChild(countDisplay);

    function createDigitScroll(){
        const scroll=document.createElement('div');
        scroll.className='digit-scroll';
        for(let i=0;i<=10;i++){
            const d=document.createElement('div');
            d.className='digit';
            d.textContent=String(i%10);
            scroll.appendChild(d);
        }
        scroll.style.top='0px';
        return scroll;
    }

    function createDigitContainerAtLeft(){
        const container=document.createElement('div');
        container.className='digit-container';
        const scroll=createDigitScroll();
        container.appendChild(scroll);
        countDisplay.prepend(container);
        digitScrolls.unshift(scroll);
        curDigits.unshift(0);
    }

    createDigitContainerAtLeft();

    function normalizeDigitsFor(len){
        while(digitScrolls.length<len) createDigitContainerAtLeft();
        while(digitScrolls.length>Math.max(1,len)){
            const first=countDisplay.firstChild;
            if(first) countDisplay.removeChild(first);
            digitScrolls.shift();
            curDigits.shift();
        }
    }

    function getEffectiveBackgroundColor(el){
        while(el){
            const style=window.getComputedStyle(el);
            const bg=style.backgroundColor;
            if(bg && bg!=='rgba(0,0,0,0)' && bg!=='transparent') return bg;
            el=el.parentElement;
        }
        return'rgb(255,255,255)';
    }

    function parseRGBtoNums(rgbStr){
        const m=rgbStr.match(/rgba?\(([^)]+)\)/);
        if(!m) return [255,255,255];
        return m[1].split(',').map(s=>Number(s.trim()));
    }

    function getLuminance(rgbStr){
        const [r,g,b]=parseRGBtoNums(rgbStr);
        return 0.2126*r+0.7152*g+0.0722*b;
    }

    function updateColorsBasedOnBackground(){
        host.style.display='none';
        const hostRect=host.getBoundingClientRect();
        const sampleX=Math.min(Math.max(0,Math.floor(hostRect.left+hostRect.width/2)),window.innerWidth-1);
        const sampleY=Math.min(Math.max(0,Math.floor(hostRect.top+hostRect.height/2)),window.innerHeight-1);
        let el=document.elementFromPoint(sampleX,sampleY)||document.body;
        const bg=getEffectiveBackgroundColor(el);
        const lum=getLuminance(bg);
        host.style.display='block';

        if(lum<128){
            catImg.style.filter='invert(1)';
            countDisplay.style.color='white';
        }else{
            catImg.style.filter='invert(0)';
            countDisplay.style.color='black';
        }
    }

    function updateCounter(num){
        const s=String(num);
        normalizeDigitsFor(s.length||1);
        for(let i=0;i<digitScrolls.length;i++){
            const nextDigit=Number(s[i]??'0');
            const scroll=digitScrolls[i];
            const cur=curDigits[i];
            if(cur===nextDigit) continue;
            scroll.style.transition='top 0.28s cubic-bezier(.21,.8,.35,1)';
            scroll.style.top=`${-nextDigit*unitHeight}px`;
            curDigits[i]=nextDigit;
        }
    }

    chrome.runtime.sendMessage({type:'requestKeyCount'});

    chrome.runtime.onMessage.addListener((msg)=>{
        if(msg?.type==='syncKeyCount' && !isNaN(msg.count)){
            keyCount=msg.count;
            updateCounter(keyCount);
            updateColorsBasedOnBackground();
        }
    });

    let saveTimer=null;
    document.addEventListener('keydown',()=>{
        keyCount++;
        updateCounter(keyCount);
        if(saveTimer) clearTimeout(saveTimer);
        saveTimer=setTimeout(()=>{
            chrome.runtime.sendMessage({type:'updateKeyCount',count:keyCount});
            chrome.storage.local.set({keyCount});
        },50);
    });

    catImg.onload=()=>{catImg.style.display='block';updateColorsBasedOnBackground();};
    setInterval(updateColorsBasedOnBackground,50);

    chrome.storage.local.get(['keyCount'],(res)=>{
        if(typeof res.keyCount==='number' && res.keyCount!==keyCount){
            keyCount=res.keyCount;
            updateCounter(keyCount);
            updateColorsBasedOnBackground();
        }
    });
}
