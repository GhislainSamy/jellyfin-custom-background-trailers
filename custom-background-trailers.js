// == Background Trailers Plugin ==
(function() {
    'use strict';

    console.log('🎬 Background Trailers Plugin - Initializing...');

    // ===== OPTIONS =====
    const defaultOptions = {
        trailerMutedByDefault: true,
        showSoundButton: true,
        enablePulseOnButton: true,
        pulseColor: 'rgba(0,150,255,0.7)',
        logoScale: 0.6,
        logoShrinkDelay: 500,
        logoShrinkDuration: 1000,
        logoFadeOpacity: 0.5,
        backdropTransition: 1000,
        backdropFadeDelay: 1500,
        backdropFadeDuration: 2000,
        backdropZoomScale: 1.80,
        globalDelay: 1200,
        enableGlobalDelay: true
    };
    
    const options = Object.assign({}, defaultOptions, window.BTPluginOptions || {});
    console.log('⚙️ Plugin options loaded:', options);

    // ===== STATE =====
    const state = {
        currentItemId: null,
        videoElement: null,
        soundButton: null,
        abortController: null,
        isActive: false,
        globalDelayTimeout: null
    };

    // ===== AUTH =====
    function getAuthHeaders() {
        try {
            const creds = JSON.parse(localStorage.getItem("jellyfin_credentials")||"{}");
            const server = creds.Servers?.[0];
            if(!server?.AccessToken) return {};
            return {
                "X-Emby-Authorization": `MediaBrowser Client="Jellyfin Web", Device="${navigator.userAgent}", DeviceId="${server.DeviceId||'browser'}", Version="10.10.0", Token="${server.AccessToken}"`,
                "Accept": "application/json"
            };
        } catch(e) {
            console.error("❌ BT getAuthHeaders error", e);
            return {};
        }
    }

    function getCurrentUserId() {
        try {
            const creds = JSON.parse(localStorage.getItem("jellyfin_credentials")||"{}");
            return creds.Servers?.[0]?.UserId || null;
        } catch(e) {
            console.error("❌ BT getCurrentUserId error", e);
            return null;
        }
    }

    // ===== UTILITIES =====
    function abortCurrentOperation() {
        if(state.abortController) {
            console.log('🚫 Aborting current operation');
            state.abortController.abort();
            state.abortController = null;
        }
        if(state.globalDelayTimeout) {
            console.log('🚫 Cancelling global delay timeout');
            clearTimeout(state.globalDelayTimeout);
            state.globalDelayTimeout = null;
        }
    }

    function createPulseAnimation() {
        const styleId = 'bt-pulse-animation';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @keyframes buttonGlowPulse {
                0%,25%,50%,75%,100% { box-shadow: 0 0 0 0 ${options.pulseColor}; transform: scale(1); }
                12.5%,37.5%,62.5%,87.5% { box-shadow: 0 0 20px 10px ${options.pulseColor}; transform: scale(1.05); }
            }
            .btnTrailerSound.spawn-animation {
                animation: buttonGlowPulse 5s ease-in-out 1;
            }
            .btnTrailerSound .detailButton-icon {
                font-size: 28px !important;
                color: #fff;
            }
            .btnTrailerSound:focus,
            .btnTrailerSound:active,
            .btnTrailerSound:hover {
                outline: none !important;
                box-shadow: none !important;
            }
        `;
        document.head.appendChild(style);
        console.log('✨ Pulse animation created');
    }

    function createBackdropStyles() {
        const styleId = 'bt-backdrop-styles';
        if (document.getElementById(styleId)) return;

        const duration = options.backdropFadeDuration / 1000;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .backdropContainer, .backdropImage, .itemBackdrop {
                transition: opacity ${duration}s ease-out;
            }
            .trailer-playing .backdropContainer,
            .trailer-playing .backdropImage,
            .trailer-playing .itemBackdrop {
                opacity: 0;
                pointer-events: none;
                filter: none;
            }
            .trailer-returning .backdropContainer,
            .trailer-returning .backdropImage,
            .trailer-returning .itemBackdrop {
                opacity: 1;
                pointer-events: auto;
                filter: none;
            }
        `;
        document.head.appendChild(style);
        console.log(`✨ Backdrop styles created with ${duration}s duration`);
    }

    function animateLogo() {
        let attempts = 0;
        const maxAttempts = 30;

        const tryAnimate = () => {
            const logo = document.querySelector('.detailLogo');
            if (!logo && attempts < maxAttempts) {
                attempts++;
                setTimeout(tryAnimate, 100);
                return;
            }
            if (!logo) return;

            logo.style.transition = 'none';
            logo.style.transform = 'scale(1) translate(0,0)';
            logo.style.opacity = '1';
            void logo.offsetWidth;

            setTimeout(() => {
                const duration = options.logoShrinkDuration / 1000;
                logo.style.transition = `transform ${duration}s ease-out, opacity ${duration}s ease-out`;
                logo.style.transform = `scale(${options.logoScale}) translate(-20%,-20%)`;
                logo.style.opacity = options.logoFadeOpacity.toString();
            }, options.logoShrinkDelay);
        };
        tryAnimate();
    }

    function setBackdropVisibility(hide) {
    const backdrops = document.querySelectorAll('.backdropContainer, .backdropImage, .itemBackdrop');
    if (!backdrops.length) return;

    const fadeDelay = options.backdropFadeDelay || 0;
    const fadeDuration = options.backdropFadeDuration || 1000; // 2s par défaut

    backdrops.forEach(el => {
        el.style.transition = `opacity ${fadeDuration}ms ease-out`;
        el.style.pointerEvents = hide ? 'none' : 'auto';
        el.style.zIndex = hide ? '-1' : '0'; // mettre derrière le trailer si caché
    });

    setTimeout(() => {
        backdrops.forEach(el => {
            el.style.opacity = hide ? '0' : '1';
        });
    }, fadeDelay);
}


    // ===== API =====
    async function getLocalTrailer(itemId, signal) {
        const userId = getCurrentUserId();
        const headers = getAuthHeaders();
        if(!userId || !headers["X-Emby-Authorization"]) return null;

        const url = `/Items/${itemId}/LocalTrailers?userId=${userId}`;
        try {
            const response = await fetch(url, { headers, signal });
            if(!response.ok) return null;
            const data = await response.json();
            return data && data.length > 0 ? data[0] : null;
        } catch(err) {
            if(err.name !== 'AbortError') console.error('❌ Trailer fetch error:', err);
            return null;
        }
    }

    // ===== UI =====
    async function createSoundButtonWithRetry(itemId, attempts = 50, interval = 100) {
        if(!options.showSoundButton) return null;
        for(let i=0;i<attempts;i++){
            if(!state.videoElement){
                await new Promise(r=>setTimeout(r, interval));
                continue;
            }

            if(!state.soundButton){
                const btn = document.createElement('button');
                btn.setAttribute('is','emby-button');
                btn.className = 'button-flat btnTrailerSound detailButton emby-button';
                btn.title = options.trailerMutedByDefault ? 'Trailer Sound (Muted)' : 'Trailer Sound (Active)';

                const content = document.createElement('div');
                content.className = 'detailButton-content';
                const icon = document.createElement('span');
                icon.className = 'material-icons detailButton-icon';
                icon.textContent = options.trailerMutedByDefault ? 'volume_off' : 'volume_up';
                content.appendChild(icon);
                btn.appendChild(content);

                btn.style.setProperty('position','absolute');
                btn.style.setProperty('top','20px');
                btn.style.setProperty('right','20px');
                btn.style.setProperty('margin-top','75px','important');
                btn.style.setProperty('margin-right','45px','important');
                btn.style.setProperty('z-index','0');
                btn.style.setProperty('width','48px');
                btn.style.setProperty('height','48px');
                btn.style.setProperty('border-radius','50%');
                btn.style.setProperty('background','rgba(0,0,0,0.5)');
                btn.style.setProperty('cursor','pointer');
                btn.style.setProperty('display','flex');
                btn.style.setProperty('justify-content','center');
                btn.style.setProperty('align-items','center');
                btn.style.setProperty('opacity','0');
                btn.style.setProperty('transition','opacity 0.3s ease-in-out, transform 0.3s ease-in-out');

                btn.addEventListener('click',(e)=>{
                    e.preventDefault(); e.stopPropagation();
                    if(!state.videoElement) return;
                    state.videoElement.muted = !state.videoElement.muted;
                    icon.textContent = state.videoElement.muted ? 'volume_off' : 'volume_up';
                    btn.title = state.videoElement.muted ? 'Trailer Sound (Muted)' : 'Trailer Sound (Active)';
                    btn.classList.remove('spawn-animation');
                });

                document.body.appendChild(btn);
                state.soundButton = btn;

                if(options.enablePulseOnButton) requestAnimationFrame(()=>btn.classList.add('spawn-animation'));
                requestAnimationFrame(()=>btn.style.setProperty('opacity','1','important'));
                return btn;
            }
            await new Promise(r=>setTimeout(r, interval));
        }
        return null;
    }

    function removeSoundButton() {
        if(!state.soundButton) return;
        state.soundButton.style.setProperty('opacity','0','important');
        setTimeout(()=>{
            if(state.soundButton?.parentElement) state.soundButton.remove();
            state.soundButton=null;
        },300);
    }

    // ===== VIDEO =====
    async function createVideo(videoUrl, signal) {
        try {
            const resp = await fetch(videoUrl,{headers:getAuthHeaders(), signal});
            if(!resp.ok) throw new Error('Video fetch failed');
            const blob = await resp.blob();

            const vid = document.createElement('video');
            vid.style.position='fixed';
            vid.style.top='0';
            vid.style.left='0';
            vid.style.width='100%';
            vid.style.height='100%';
            vid.style.objectFit='cover';
            vid.style.zIndex='-1';
            vid.style.opacity='0';
            vid.style.transition=`opacity ${options.backdropTransition}ms ease-in-out`;
            vid.autoplay=true; vid.loop=true; vid.muted=options.trailerMutedByDefault; vid.playsInline=true; vid.volume=0.5;
            vid.src=URL.createObjectURL(blob);
            document.body.appendChild(vid);

            await vid.play();
            setTimeout(()=>createSoundButtonWithRetry(state.currentItemId),100);
            animateLogo();
            setBackdropVisibility(true); // fade out backdrop
            setTimeout(()=>{ if(vid?.parentElement) vid.style.opacity='1'; },100);

            return vid;
        } catch(err){
            removeSoundButton();
            return null;
        }
    }

    function clearTrailer(immediate=false){
        abortCurrentOperation();
        removeSoundButton();
        setBackdropVisibility(false);

        if(!state.videoElement) { state.currentItemId=null; state.isActive=false; return; }

        if(immediate){
            if(state.videoElement.src.startsWith('blob:')) URL.revokeObjectURL(state.videoElement.src);
            state.videoElement.pause();
            state.videoElement.remove();
            state.videoElement=null;
            state.currentItemId=null; 
            state.isActive=false;
        } else {
            state.videoElement.style.opacity='0';
            setTimeout(()=>{
                if(state.videoElement){
                    if(state.videoElement.src.startsWith('blob:')) URL.revokeObjectURL(state.videoElement.src);
                    state.videoElement.pause();
                    state.videoElement.remove();
                    state.videoElement=null;
                }
                state.currentItemId=null;
                state.isActive=false;
            },options.backdropTransition);
        }
    }

    // ===== SHOW TRAILER =====
    async function showBackgroundTrailerWithDelay(itemId) {
        if(options.enableGlobalDelay && options.globalDelay>0){
            await new Promise(resolve => state.globalDelayTimeout=setTimeout(()=>{state.globalDelayTimeout=null; resolve();}, options.globalDelay));
        }
        await showBackgroundTrailer(itemId);
    }

    async function showBackgroundTrailer(itemId){
        if(state.currentItemId===itemId || state.isActive) return;
        state.isActive=true;
        abortCurrentOperation();

        if(state.currentItemId && state.currentItemId!==itemId){
            clearTrailer(true);
            await new Promise(r=>setTimeout(r,200));
        }

        state.currentItemId=itemId;
        state.abortController=new AbortController();
        const signal=state.abortController.signal;

        const trailer=await getLocalTrailer(itemId,signal);
        if(signal.aborted){ state.isActive=false; return; }

        if(trailer?.Id){
            const videoUrl=`/Videos/${trailer.Id}/stream?static=true`;
            state.videoElement=await createVideo(videoUrl,signal);
            if(!state.videoElement) state.currentItemId=null;
        } else state.currentItemId=null;

        state.isActive=false;
    }

    // ===== EVENTS =====
    function onViewShow(){
        setTimeout(()=>{
            const hash=window.location.hash;
            const params=new URLSearchParams(hash.split('?')[1]);
            const itemId=params.get('id');
            const page=document.querySelector('.itemDetailPage');
            if(page && itemId) showBackgroundTrailerWithDelay(itemId);
            else if(state.currentItemId) clearTrailer(false);
        },200);
    }

    function onViewBeforeHide(){ if(state.currentItemId) clearTrailer(true); }

    function bindEvents(){
        [document,window,document.body].forEach(t=>{ t.addEventListener('viewshow',onViewShow); t.addEventListener('viewbeforehide',onViewBeforeHide); });
    }

    // ===== INIT =====
    function init(){
        createBackdropStyles();
        if(options.enablePulseOnButton) createPulseAnimation();
        bindEvents();

        setTimeout(()=>{
            const hash=window.location.hash;
            if(hash.includes('/details') || hash.includes('id=')){
                const params=new URLSearchParams(hash.split('?')[1]);
                const itemId=params.get('id');
                if(itemId) showBackgroundTrailerWithDelay(itemId);
            }
        },1000);

        window.addEventListener('beforeunload',()=>clearTrailer(true));
        document.addEventListener('visibilitychange',()=>{
            if(state.videoElement) document.hidden ? state.videoElement.pause() : state.videoElement.play().catch(()=>{});
        });

        console.log('✅ Background Trailers Plugin initialized!');
    }

    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
    else init();

})();
