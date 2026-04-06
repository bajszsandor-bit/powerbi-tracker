// A popup ablak JS vezérlése (alap beállítások mentése a Chrome Storage-be)

document.addEventListener('DOMContentLoaded', () => {
    const voiceSelect = document.getElementById('voiceSelect');
    const rateSelect = document.getElementById('rateSelect');
    const saveBtn = document.getElementById('saveBtn');

    // Betöltés
    chrome.storage.sync.get(['dubVoice', 'dubRate'], (result) => {
        if (result.dubVoice) voiceSelect.value = result.dubVoice;
        if (result.dubRate) rateSelect.value = result.dubRate;
    });

    // Mentés
    saveBtn.addEventListener('click', () => {
        const settings = {
            dubVoice: voiceSelect.value,
            dubRate: rateSelect.value
        };
        
        chrome.storage.sync.set(settings, () => {
            saveBtn.textContent = 'Mentve!';
            saveBtn.style.background = '#10b981'; // Zöld
            setTimeout(() => {
                saveBtn.textContent = 'Beállítások Mentése';
                saveBtn.style.background = '#3b82f6';
            }, 1500);
        });
    });
});
