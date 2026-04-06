// content.js - Beépül a YouTube-ba

let videoId = null;
let dubAudioElement = null;
let ytVideoElement = null;
let checkInterval = null;

function getYouTubeId(url) {
    const urlParams = new URL(url).searchParams;
    return urlParams.get('v');
}

function callBackgroundApi(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'fetchLocalApi', endpoint, method, body },
            (response) => {
                if (response && response.success) resolve(response.data);
                else reject(new Error(response?.error || 'Unknown error'));
            }
        );
    });
}

async function startDubbingProcess(btn) {
    const currentUrl = window.location.href;
    videoId = getYouTubeId(currentUrl);
    if (!videoId) return alert('Nem található videó ID.');

    btn.classList.add('dub-loading');
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2v4c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 21.52 2 16H6c0 3.31 2.69 6 6 6s6-2.69 6-6-2.69-6-6-6V2m0 0l-4 4h8l-4-4z"/></svg> Előkészítés (yt-dlp)...`;

    try {
        // 1. Import
        await callBackgroundApi('/import-video', 'POST', { url: currentUrl });

        // 2. Poll for translation readiness
        btn.innerHTML = `Várakozás fordításra...`;
        let isReady = false;
        let pTimeout = 0;
        while (!isReady && pTimeout < 30) {
            await new Promise(r => setTimeout(r, 2000));
            const statData = await callBackgroundApi(`/videos/${videoId}`);
            if (statData.transcriptCuesHu && statData.transcriptCuesHu.length > 0) isReady = true;
            pTimeout++;
        }

        if (!isReady) throw new Error('Fordítás időtúllépés.');

        // 3. Start Dubtrack generation
        btn.innerHTML = `Magyar hang CPU generálása... (percekig tarthat)`;
        
        // Lekérjük a beállításokat a popup-ból
        const prefs = await new Promise(r => chrome.storage.sync.get(['dubVoice', 'dubRate'], r));
        const voice = prefs.dubVoice || 'noemi';
        const rate = prefs.dubRate || '-10%';

        // Ez a hívás hosszú (visszaadhat egy timeoutot is akár)
        callBackgroundApi(`/videos/${videoId}/generate-dubtrack`, 'POST', { voice, rate }).catch(e => console.warn('Hosszú hívás', e));

        // 4. Poll progress
        checkInterval = setInterval(async () => {
            try {
                const prog = await callBackgroundApi(`/videos/${videoId}/dubtrack-progress`);
                if (prog.total > 0) {
                    const pct = Math.round((prog.done / prog.total) * 100);
                    btn.innerHTML = `Generálás: ${pct}%`;
                    if (pct >= 100) checkDubtrackExists(btn);
                } else {
                    checkDubtrackExists(btn);
                }
            } catch (e) { /* ignore */ }
        }, 3000);

    } catch (err) {
        btn.classList.remove('dub-loading');
        btn.innerHTML = `Szinkron hiba: ${err.message}`;
        setTimeout(() => resetBtn(btn), 4000);
    }
}

async function checkDubtrackExists(btn) {
    try {
        // Just send a HEAD request effectively or try to fetch details
        const res = await callBackgroundApi(`/videos/${videoId}`);
        // To be confident, we just set it up anyway if it's 100%
        clearInterval(checkInterval);
        setupAudioPlayer(btn);
    } catch (e) {
        // Wait longer
    }
}

function setupAudioPlayer(btn) {
    btn.classList.remove('dub-loading');
    btn.classList.add('dub-ready');
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg> Magyar Hang Aktív`;

    if (!dubAudioElement) {
        dubAudioElement = document.createElement('audio');
        document.body.appendChild(dubAudioElement);
    }
    
    dubAudioElement.src = `http://localhost:3001/api/videos/${videoId}/dubtrack?t=${Date.now()}`;
    
    // Némítjuk az eredeti videót (vagy 5%-ra vesszük a háttérzaj miatt)
    ytVideoElement.volume = 0.05;

    // Szinkronizálás a YT lejátszóval
    syncAudioToVideo();
}

function syncAudioToVideo() {
    if (!ytVideoElement || !dubAudioElement) return;

    ytVideoElement.addEventListener('play', () => { dubAudioElement.play(); });
    ytVideoElement.addEventListener('pause', () => { dubAudioElement.pause(); });
    ytVideoElement.addEventListener('seeking', () => { dubAudioElement.currentTime = ytVideoElement.currentTime; });
    ytVideoElement.addEventListener('ratechange', () => { dubAudioElement.playbackRate = ytVideoElement.playbackRate; });
    ytVideoElement.addEventListener('waiting', () => { dubAudioElement.pause(); });
    ytVideoElement.addEventListener('playing', () => { 
        if(Math.abs(dubAudioElement.currentTime - ytVideoElement.currentTime) > 0.5) {
            dubAudioElement.currentTime = ytVideoElement.currentTime;
        }
        dubAudioElement.play(); 
    });
}

function resetBtn(btn) {
    btn.classList.remove('dub-loading', 'dub-ready');
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg> Magyar Szinkron Helyi`;
}

function injectButton() {
    if (document.getElementById('pbi-dub-btn')) return;

    // Keressük meg a YouTube címe alatti kezelőszerveket
    const topRow = document.querySelector('div#top-row.ytd-watch-metadata');
    if (!topRow) return;

    const actionMenu = topRow.querySelector('div#actions');
    if (!actionMenu) return;

    ytVideoElement = document.querySelector('video.video-stream');
    if (!ytVideoElement) return;

    const btn = document.createElement('button');
    btn.id = 'pbi-dub-btn';
    btn.className = 'pbi-dub-btn';
    resetBtn(btn);

    btn.addEventListener('click', () => {
        if (!btn.classList.contains('dub-loading') && !btn.classList.contains('dub-ready')) {
            startDubbingProcess(btn);
        }
    });

    actionMenu.prepend(btn);
}

// Folyamatos figyelés a YouTube SPA navigáció miatt
const observer = new MutationObserver(() => {
    if (window.location.pathname === '/watch') injectButton();
});
observer.observe(document.body, { childList: true, subtree: true });

// Első betöltés
if (window.location.pathname === '/watch') setTimeout(injectButton, 2000);
