(function () {
    const API_BASE = 'http://localhost:3000/api';

    // Helper: Generate or retrieve Session ID
    function getSessionId() {
        let sid = localStorage.getItem('ab_session_id');
        if (!sid) {
            sid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            localStorage.setItem('ab_session_id', sid);
        }
        return sid;
    }

    const sessionId = getSessionId();
    const currentUrl = window.location.href;

    // Debug banner
    function showStatus(msg, color) {
        let banner = document.getElementById('ab-status-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'ab-status-banner';
            banner.style.cssText = 'position:fixed;bottom:10px;right:10px;padding:8px 14px;border-radius:6px;font-size:13px;font-family:monospace;z-index:99999;max-width:320px;word-break:break-word;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
            document.body.appendChild(banner);
        }
        banner.style.background = color || '#333';
        banner.style.color = '#fff';
        banner.innerHTML = '🧪 AB Tracker: ' + msg;
    }

    // Helper: Hash function for consistent bucket assignment
    function hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h) + str.charCodeAt(i);
            h = h & h;
        }
        return Math.abs(h);
    }

    showStatus('Checking experiments...', '#555');

    // 1. Fetch Active Experiments
    fetch(`${API_BASE}/experiments/active?url=${encodeURIComponent(currentUrl)}`)
        .then(res => {
            if (!res.ok) throw new Error('API returned ' + res.status);
            return res.json();
        })
        .then(experiments => {
            if (!experiments || experiments.length === 0) {
                showStatus('No active experiments for this URL.', '#888');
                console.log('[AB] No experiments found for:', currentUrl);
                return;
            }

            showStatus(`Found ${experiments.length} experiment(s). Running...`, '#2563eb');
            experiments.forEach(exp => runExperiment(exp));
        })
        .catch(err => {
            showStatus('Error: ' + err.message + ' — Is backend running on port 3000?', '#dc2626');
            console.error('[AB] Error fetching experiments:', err);
        });

    function runExperiment(exp) {
        const variants = exp.variants;
        if (!variants || variants.length === 0) {
            showStatus('Experiment has no variants!', '#f59e0b');
            return;
        }

        const totalWeight = variants.reduce((acc, v) => acc + (v.weight || 50), 0);
        const bucketVal = hash(sessionId + exp.id) % totalWeight;

        let cumWeight = 0;
        let selectedVariant = null;

        for (const v of variants) {
            cumWeight += (v.weight || 50);
            if (bucketVal < cumWeight) {
                selectedVariant = v;
                break;
            }
        }

        if (!selectedVariant) selectedVariant = variants[0]; // fallback

        console.log(`[AB] Experiment: "${exp.name}" → Variant: "${selectedVariant.name}"`);
        showStatus(`Variant: <b>${selectedVariant.name}</b>`, '#16a34a');

        // Track Impression
        trackEvent(exp.id, selectedVariant.id, 'impression');

        // Apply Variant
        if (selectedVariant.type === 'redirect') {
            // Normalize to avoid redirect loops
            const normalize = url => url.replace('127.0.0.1', 'localhost').replace(/\/$/, '');
            if (normalize(window.location.href) !== normalize(selectedVariant.content)) {
                console.log('[AB] Redirecting to:', selectedVariant.content);
                showStatus('Redirecting to Variant B...', '#7c3aed');
                setTimeout(() => window.location.replace(selectedVariant.content), 300);
            }
        } else if (selectedVariant.type === 'code') {
            try {
                const func = new Function(selectedVariant.content);
                func();
            } catch (e) {
                console.error('[AB] Code execution failed', e);
            }
        } else if (selectedVariant.type === 'visual') {
            const style = document.createElement('style');
            style.textContent = selectedVariant.content;
            document.head.appendChild(style);
        }

        // Setup Conversion Tracking
        document.addEventListener('click', (e) => {
            try {
                const goals = JSON.parse(exp.goals || '[]');
                goals.forEach(goalSelector => {
                    if (e.target.closest && e.target.closest(goalSelector)) {
                        trackEvent(exp.id, selectedVariant.id, 'conversion', goalSelector);
                        showStatus('✅ Conversion tracked! Check Dashboard.', '#16a34a');
                        console.log('[AB] Conversion tracked for goal:', goalSelector);
                    }
                });
            } catch (err) {
                console.error('[AB] Goal matching error:', err);
            }
        });
    }

    function trackEvent(expId, varId, type, goalId = null) {
        fetch(`${API_BASE}/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                experiment_id: expId,
                variant_id: varId,
                session_id: sessionId,
                event_type: type,
                goal_id: goalId
            })
        })
            .then(r => r.json())
            .then(d => console.log('[AB] Tracked', type, d))
            .catch(e => console.error('[AB] Track error', e));
    }

})();
