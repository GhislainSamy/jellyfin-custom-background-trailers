// == Background Trailers Plugin 10.11 ==
(function() {
    'use strict';

    console.log('🎬 Background Trailers Plugin - Initializing...');

    // ===== OPTIONS =====
    // Récupérer les options depuis window.BTPluginOptions ou utiliser les valeurs par défaut
    const defaultOptions = {
        trailerMutedByDefault: true,
        showSoundButton: true,
        enablePulseOnButton: true,
        pulseColor: 'rgba(165, 0, 0, 1)', // Rouge vif
        logoScale: 0.6,
        logoShrinkDelay: 500,
        logoShrinkDuration: 1000,
        logoFadeOpacity: 0.5,
        backdropTransition: 1000,
        backdropFadeDelay: 500,
        backdropFadeDuration: 1000,
        backdropZoomScale: 1.15
    };
    
    const options = Object.assign({}, defaultOptions, window.BTPluginOptions || {});
    
    console.log('⚙️ Plugin options loaded:', options);

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

    function createPulseAnimation() {
        // Vérifier si l'animation existe déjà
        const styleId = 'bt-pulse-animation';
        if (document.getElementById(styleId)) return;

        // Créer la keyframe animation avec la couleur paramétrable + styles du bouton
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @keyframes buttonGlowPulse {
                0% { box-shadow: 0 0 0 0 ${options.pulseColor}; transform: scale(1); }
                12.5% { box-shadow: 0 0 20px 10px ${options.pulseColor}; transform: scale(1.05); }
                25% { box-shadow: 0 0 0 0 ${options.pulseColor}; transform: scale(1); }
                37.5% { box-shadow: 0 0 20px 10px ${options.pulseColor}; transform: scale(1.05); }
                50% { box-shadow: 0 0 0 0 ${options.pulseColor}; transform: scale(1); }
                62.5% { box-shadow: 0 0 20px 10px ${options.pulseColor}; transform: scale(1.05); }
                75% { box-shadow: 0 0 0 0 ${options.pulseColor}; transform: scale(1); }
                87.5% { box-shadow: 0 0 20px 10px ${options.pulseColor}; transform: scale(1.05); }
                100% { box-shadow: 0 0 0 0 ${options.pulseColor}; transform: scale(1); }
            }
            .btnTrailerSound.spawn-animation {
                animation: buttonGlowPulse 5s ease-in-out 1;
            }
            /* Icône du bouton */
            .btnTrailerSound .detailButton-icon {
                font-size: 28px !important;
                color: #fff;
            }
            /* Supprimer outline au focus / hover / active */
            .btnTrailerSound:focus,
            .btnTrailerSound:active,
            .btnTrailerSound:hover {
                outline: none !important;
                box-shadow: none !important;
            }
        `;
        document.head.appendChild(style);
        console.log('✨ Pulse animation and button styles created with color:', options.pulseColor);
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
            logo.style.opacity = '1'; // Reset opacité
            void logo.offsetWidth;
            
            console.log(`✅ Logo found and reset, animating in ${options.logoShrinkDelay}ms...`);
            
            // Animer après le délai configuré
            setTimeout(() => {
                const duration = options.logoShrinkDuration / 1000; // convertir ms en secondes
                logo.style.transition = `transform ${duration}s ease-out, opacity ${duration}s ease-out`;
                logo.style.transform = `scale(${options.logoScale}) translate(-20%, -20%)`;
                logo.style.opacity = options.logoFadeOpacity.toString();
                console.log(`🎬 Logo shrink applied with opacity ${options.logoFadeOpacity}!`);
            }, options.logoShrinkDelay);
        };
        
        tryAnimate();
    }

    function animateBackdrop() {
        console.log('🖼️ Starting backdrop fade animation sequence');
        
        // Attendre que les backdrops soient chargés avec un retry
        let attempts = 0;
        const maxAttempts = 30;
        
        const tryAnimate = () => {
            // Chercher TOUS les éléments backdrop possibles
            const backdrops = document.querySelectorAll('.backdropContainer, .backdropImage, .itemBackdrop');
            
            if (backdrops.length === 0 && attempts < maxAttempts) {
                attempts++;
                console.log(`⏳ Waiting for backdrop... attempt ${attempts}`);
                setTimeout(tryAnimate, 100);
                return;
            }
            
            if (backdrops.length === 0) {
                console.warn('⚠️ No backdrop found after max attempts');
                return;
            }
            
            console.log(`✅ Found ${backdrops.length} backdrop element(s), resetting...`);
            
            // RESET complet - tous les backdrops visibles
            backdrops.forEach(backdrop => {
                backdrop.style.setProperty('transition', 'none');
                backdrop.style.setProperty('opacity', '1');
                backdrop.style.setProperty('filter', 'blur(0px) brightness(1)');
                backdrop.style.setProperty('transform', 'scale(1)');
                void backdrop.offsetWidth;
            });
            
            console.log('✅ Backdrop(s) reset, fading out in ' + options.backdropFadeDelay + 'ms...');
            
            // Animer le fade out après un délai
            setTimeout(() => {
                const duration = options.backdropFadeDuration / 1000; // convertir ms en secondes
                backdrops.forEach(backdrop => {
                    // Utiliser setProperty avec important pour écraser le CSS
                    backdrop.style.setProperty('transition', `opacity ${duration}s ease-out, filter ${duration}s ease-out, transform ${duration}s ease-out`);
                    backdrop.style.setProperty('opacity', '0');
                    backdrop.style.setProperty('filter', 'blur(10px) brightness(0.7)');
                    backdrop.style.setProperty('transform', `scale(${options.backdropZoomScale})`);
                });
                console.log(`🖼️ Backdrop fade applied with ${duration}s duration and ${options.backdropZoomScale}x zoom!`);
            }, options.backdropFadeDelay);
        };
        
        tryAnimate();
    }

    function fadeBackdrop() {
        console.log('🖼️ Starting backdrop fade sequence');
        
        // Attendre que le backdrop soit chargé avec un retry
        let attempts = 0;
        const maxAttempts = 30;
        
        const tryFade = () => {
            const backdrop = document.querySelector('.backdropContainer, .backdropImage, .itemBackdrop');
            
            if (!backdrop && attempts < maxAttempts) {
                attempts++;
                console.log(`⏳ Waiting for backdrop... attempt ${attempts}`);
                setTimeout(tryFade, 100);
                return;
            }
            
            if (!backdrop) {
                console.warn('⚠️ Backdrop not found after max attempts');
                return;
            }
            
            console.log('✅ Backdrop found, fading out in 500ms...');
            
            // Reset d'abord
            document.body.classList.remove('trailer-playing', 'trailer-returning');
            
            // Attendre puis appliquer le fade
            setTimeout(() => {
                document.body.classList.add('trailer-playing');
                console.log('🖼️ Backdrop fade applied!');
            }, 500);
        };
        
        tryFade();
    }

    function animateBackdrop() {
        console.log('🖼️ Starting backdrop fade animation sequence');
        
        // Attendre que le backdrop soit chargé avec un retry
        let attempts = 0;
        const maxAttempts = 30;
        
        const tryAnimate = () => {
            const backdrop = document.querySelector('.backdropContainer, .backdropImage, .itemBackdrop');
            
            if (!backdrop && attempts < maxAttempts) {
                attempts++;
                console.log(`⏳ Waiting for backdrop... attempt ${attempts}`);
                setTimeout(tryAnimate, 100);
                return;
            }
            
            if (!backdrop) {
                console.warn('⚠️ Backdrop not found after max attempts');
                return;
            }
            
            console.log('✅ Backdrop found, fading out in 500ms...');
            
            // S'assurer que le backdrop est visible d'abord
            document.body.classList.remove('trailer-playing');
            document.body.classList.add('trailer-returning');
            void backdrop.offsetWidth;
            
            // Puis fade vers transparent après un délai
            setTimeout(() => {
                document.body.classList.remove('trailer-returning');
                document.body.classList.add('trailer-playing');
                console.log('🖼️ Backdrop fade to transparent applied!');
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

                // Appliquer les styles avec important pour forcer
                btn.style.setProperty('position', 'absolute');
                btn.style.setProperty('top', '20px');
                btn.style.setProperty('right', '20px');
                btn.style.setProperty('margin-top', '75px', 'important');
                btn.style.setProperty('margin-right', '45px', 'important');
                btn.style.setProperty('z-index', '0');
                btn.style.setProperty('width', '48px');
                btn.style.setProperty('height', '48px');
                btn.style.setProperty('border-radius', '50%');
                btn.style.setProperty('background', 'rgba(0,0,0,0.5)');
                btn.style.setProperty('cursor', 'pointer');
                btn.style.setProperty('display', 'flex');
                btn.style.setProperty('justify-content', 'center');
                btn.style.setProperty('align-items', 'center');
                btn.style.setProperty('opacity', '0');
                btn.style.setProperty('transition', 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out');

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

                requestAnimationFrame(()=>btn.style.setProperty('opacity', '1'));
                return btn;
            }

            await new Promise(r=>setTimeout(r, interval));
        }

        console.warn('⚠️ Could not create sound button after retries');
        return null;
    }

    function removeSoundButton() {
        if(!state.soundButton) return;
        state.soundButton.style.setProperty('opacity', '0');
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

            // Animation logo et backdrop
            animateLogo();
            animateBackdrop();

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

        // Remettre le backdrop visible (reset immédiat)
        document.body.classList.remove('trailer-playing', 'trailer-returning');

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
        // Créer l'animation pulse si activée
        if(options.enablePulseOnButton) {
            createPulseAnimation();
        }
        
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
