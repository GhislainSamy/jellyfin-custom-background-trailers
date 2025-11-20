// == Background Trailers Plugin 10.11 ==
(function() {
    'use strict';

    console.log('🎬 Background Trailers Plugin - Initializing...');

    // ===== OPTIONS =====
    const options = {
        trailerMutedByDefault: true,
        showSoundButton: true,
        enablePulseOnButton: true,
        logoScale: 0.6,          // réduction progressive du logo (1 = 100%, 0.6 = -40%)
        backdropTransition: 1000 // en ms
    };

    // ===== STATE =====
    const state = {
        currentItemId: null,
        videoElement: null,
        soundButton: null,
        abortController: null,
        isActive: false
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
    }

    function animateLogo() {
        console.log('🎬 Starting logo shrink animation sequence');
        
        // Attendre que le logo soit chargé avec un retry
        let attempts = 0;
        const maxAttempts = 30;
        
        const tryAnimate = () => {
            const logo = document.querySelector('.detailLogo');
            
            if (!logo && attempts < maxAttempts) {
                attempts++;
                console.log(`⏳ Waiting for logo... attempt ${attempts}`);
                setTimeout(tryAnimate, 100);
                return;
            }
            
            if (!logo) {
                console.warn('⚠️ Logo not found after max attempts');
                return;
            }
            
            // RESET complet
            logo.style.transition = 'none';
            logo.style.transform = 'scale(1) translate(0, 0)';
            void logo.offsetWidth;
            
            console.log('✅ Logo found and reset, animating in 500ms...');
            
            // Animer après un délai plus long pour être sûr
            setTimeout(() => {
                logo.style.transition = 'transform 1s ease-out';
                logo.style.transform = `scale(${options.logoScale}) translate(-20%, -20%)`;
                console.log('🎬 Logo shrink applied!');
            }, 500);
        };
        
        tryAnimate();
    }

    // ===== API =====
    async function getLocalTrailer(itemId, signal) {
        const userId = getCurrentUserId();
        const headers = getAuthHeaders();
        if(!userId || !headers["X-Emby-Authorization"]) return null;

        const url = `/Items/${itemId}/LocalTrailers?userId=${userId}`;
        console.log('🌐 Fetch trailer:', url);

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
    function setLogoVisibility(hide) {
        const logo = document.querySelector('.detailLogo');
        if(!logo) return;
        document.body.classList.remove('trailer-playing', 'trailer-returning');
        requestAnimationFrame(() => {
            document.body.classList.add(hide ? 'trailer-playing' : 'trailer-returning');
        });
    }

    async function createSoundButtonWithRetry(itemId, attempts = 50, interval = 100) {
        if(!options.showSoundButton) return null;

        console.log(`🎧 Starting dynamic sound button creation for itemId: ${itemId}`);
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

                Object.assign(btn.style, {
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    marginTop: '75px',
                    marginRight: '45px',
                    zIndex: 9999,
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: 0,
                    transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out'
                });

                btn.addEventListener('click',(e)=>{
                    e.preventDefault(); e.stopPropagation();
                    if(!state.videoElement) return;
                    state.videoElement.muted = !state.videoElement.muted;
                    icon.textContent = state.videoElement.muted ? 'volume_off' : 'volume_up';
                    btn.title = state.videoElement.muted ? 'Trailer Sound (Muted)' : 'Trailer Sound (Active)';

                    // Stop pulse animation au click
                    btn.classList.remove('spawn-animation');
                });

                document.body.appendChild(btn);
                state.soundButton = btn;

                if(options.enablePulseOnButton) {
                    requestAnimationFrame(()=>btn.classList.add('spawn-animation'));
                }

                requestAnimationFrame(()=>btn.style.opacity='1');
                return btn;
            }

            await new Promise(r=>setTimeout(r, interval));
        }

        console.warn('⚠️ Could not create sound button after retries');
        return null;
    }

    function removeSoundButton() {
        if(!state.soundButton) return;
        state.soundButton.style.opacity='0';
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
            Object.assign(vid.style,{
                position:'fixed',
                top:0,
                left:0,
                width:'100%',
                height:'100%',
                objectFit:'cover',
                zIndex:'-1',
                opacity:0,
                transition:`opacity ${options.backdropTransition}ms ease-in-out`
            });
            vid.autoplay=true; vid.loop=true; vid.muted=options.trailerMutedByDefault; vid.playsInline=true; vid.volume=0.5;
            vid.src=URL.createObjectURL(blob);
            document.body.appendChild(vid);

            await vid.play();

            // Crée le bouton son après vidéo
            setTimeout(()=>createSoundButtonWithRetry(state.currentItemId),100);

            // Animation logo
            animateLogo();

            // Fade in video
            setTimeout(()=>{ if(vid?.parentElement) vid.style.opacity='1'; },100);

            return vid;
        } catch(err){
            if(err.name!=='AbortError') console.error('❌ Video error:',err);
            removeSoundButton();
            return null;
        }
    }

    function clearTrailer(immediate=false){
        console.log('🧹 Clearing trailer, immediate:', immediate);
        abortCurrentOperation();
        removeSoundButton();

        if(!state.videoElement){
            state.currentItemId=null; 
            state.isActive=false;
            return;
        }

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

    async function showBackgroundTrailer(itemId){
        console.log('🎥 showBackgroundTrailer called for itemId:', itemId);
        
        if(state.currentItemId===itemId || state.isActive) {
            console.log('⏭️ Already showing this trailer or busy');
            return;
        }
        
        state.isActive=true;
        abortCurrentOperation();

        if(state.currentItemId && state.currentItemId!==itemId){
            console.log('🔄 Switching trailers, clearing current one');
            clearTrailer(true);
            await new Promise(r=>setTimeout(r,200)); // Augmenter le délai
        }

        state.currentItemId=itemId;
        state.abortController=new AbortController();
        const signal=state.abortController.signal;

        const trailer=await getLocalTrailer(itemId,signal);
        if(signal.aborted){ 
            console.log('🚫 Operation aborted');
            state.isActive=false; 
            return; 
        }

        if(trailer?.Id){
            console.log('✅ Trailer found, creating video');
            const videoUrl=`/Videos/${trailer.Id}/stream?static=true`;
            state.videoElement=await createVideo(videoUrl,signal);
            if(!state.videoElement) state.currentItemId=null;
        } else {
            console.log('❌ No trailer found for this item');
            state.currentItemId=null;
        }

        state.isActive=false;
    }

    // ===== EVENTS =====
    function onViewShow(e){
        setTimeout(()=>{
            const hash=window.location.hash;
            const params=new URLSearchParams(hash.split('?')[1]);
            const itemId=params.get('id');
            const page=document.querySelector('.itemDetailPage');
            if(page && itemId) showBackgroundTrailer(itemId);
            else if(state.currentItemId) clearTrailer(false);
        },200);
    }

    function onViewBeforeHide(e){
        if(state.currentItemId) clearTrailer(true);
    }

    function bindEvents(){
        [document,window,document.body].forEach(target=>{
            target.addEventListener('viewshow', onViewShow);
            target.addEventListener('viewbeforehide', onViewBeforeHide);
        });
    }

    // ===== INIT =====
    function init(){
        bindEvents();
        
        // initial check
        setTimeout(()=>{
            const hash=window.location.hash;
            if(hash.includes('/details') || hash.includes('id=')){
                const params=new URLSearchParams(hash.split('?')[1]);
                const itemId=params.get('id');
                if(itemId) showBackgroundTrailer(itemId);
            }
        },1000);

        window.addEventListener('beforeunload',()=>clearTrailer(true));
        document.addEventListener('visibilitychange',()=>{
            if(state.videoElement){
                document.hidden ? state.videoElement.pause() : state.videoElement.play().catch(()=>{});
            }
        });

        console.log('✅ Background Trailers Plugin initialized!');
    }

    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
    else init();

})();