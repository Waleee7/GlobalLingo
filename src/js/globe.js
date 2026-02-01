        / ==========================================
        // ANIMATED BACKGROUND SYSTEM
        // ==========================================
        const bgCanvas = document.getElementById('background-canvas');
        const bgCtx = bgCanvas.getContext('2d');
        
        let backgroundActive = false;
        let timeOfDay = 'day'; // will be set based on user's time
        
        // Grass blades for animation
        let grassBlades = [];
        let clouds = [];
        let birds = [];
        
        function resizeBgCanvas() {
            bgCanvas.width = window.innerWidth;
            bgCanvas.height = window.innerHeight;
            initializeBackground();
        }
        
        function initializeBackground() {
            // Determine time of day
            const hour = new Date().getHours();
            if (hour >= 6 && hour < 12) timeOfDay = 'morning';
            else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
            else if (hour >= 17 && hour < 20) timeOfDay = 'evening';
            else timeOfDay = 'night';
            
            // Initialize grass blades
            grassBlades = [];
            for (let i = 0; i < 150; i++) {
                grassBlades.push({
                    x: Math.random() * bgCanvas.width,
                    y: bgCanvas.height - Math.random() * 200,
                    height: 40 + Math.random() * 60,
                    width: 2 + Math.random() * 3,
                    swayOffset: Math.random() * Math.PI * 2,
                    swaySpeed: 0.02 + Math.random() * 0.03,
                    baseColor: {
                        r: 34 + Math.random() * 40,
                        g: 139 + Math.random() * 40,
                        b: 34 + Math.random() * 20
                    }
                });
            }
            
            // Initialize clouds
            clouds = [];
            for (let i = 0; i < 8; i++) {
                clouds.push({
                    x: Math.random() * bgCanvas.width,
                    y: 50 + Math.random() * 150,
                    width: 80 + Math.random() * 120,
                    height: 40 + Math.random() * 40,
                    speed: 0.1 + Math.random() * 0.3,
                    opacity: 0.3 + Math.random() * 0.4
                });
            }
            
            // Initialize birds
            birds = [];
            for (let i = 0; i < 5; i++) {
                birds.push({
                    x: -100 + Math.random() * bgCanvas.width,
                    y: 100 + Math.random() * 200,
                    speed: 1 + Math.random() * 2,
                    wingPhase: Math.random() * Math.PI * 2,
                    active: Math.random() > 0.5
                });
            }
        }
        
        function drawBackground() {
            if (!backgroundActive) return;
            
            // Sky gradient based on time of day
            const skyGradient = bgCtx.createLinearGradient(0, 0, 0, bgCanvas.height);
            
            switch(timeOfDay) {
                case 'morning':
                    skyGradient.addColorStop(0, '#87CEEB');
                    skyGradient.addColorStop(1, '#B0E0E6');
                    break;
                case 'afternoon':
                    skyGradient.addColorStop(0, '#4A90E2');
                    skyGradient.addColorStop(1, '#87CEEB');
                    break;
                case 'evening':
                    skyGradient.addColorStop(0, '#FF6B35');
                    skyGradient.addColorStop(0.5, '#F7931E');
                    skyGradient.addColorStop(1, '#FDC830');
                    break;
                case 'night':
                    skyGradient.addColorStop(0, '#0B1026');
                    skyGradient.addColorStop(1, '#1a237e');
                    break;
            }
            
            bgCtx.fillStyle = skyGradient;
            bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
            
            // Draw stars for night
            if (timeOfDay === 'night') {
                bgCtx.fillStyle = '#ffffff';
                for (let i = 0; i < 100; i++) {
                    const x = (i * 137.5) % bgCanvas.width;
                    const y = (i * 97.3) % (bgCanvas.height * 0.6);
                    bgCtx.fillRect(x, y, 2, 2);
                }
            }
            
            // Draw and animate clouds
            clouds.forEach(cloud => {
                bgCtx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
                bgCtx.beginPath();
                bgCtx.ellipse(cloud.x, cloud.y, cloud.width, cloud.height, 0, 0, Math.PI * 2);
                bgCtx.fill();
                
                // Smaller cloud puffs
                bgCtx.ellipse(cloud.x + cloud.width * 0.5, cloud.y, cloud.width * 0.7, cloud.height * 0.8, 0, 0, Math.PI * 2);
                bgCtx.fill();
                bgCtx.ellipse(cloud.x - cloud.width * 0.5, cloud.y, cloud.width * 0.6, cloud.height * 0.7, 0, 0, Math.PI * 2);
                bgCtx.fill();
                
                cloud.x += cloud.speed;
                if (cloud.x > bgCanvas.width + cloud.width) {
                    cloud.x = -cloud.width;
                }
            });
            
            // Draw ground/field
            const groundGradient = bgCtx.createLinearGradient(0, bgCanvas.height * 0.6, 0, bgCanvas.height);
            groundGradient.addColorStop(0, '#4d7c0f');
            groundGradient.addColorStop(0.5, '#65a30d');
            groundGradient.addColorStop(1, '#4d7c0f');
            bgCtx.fillStyle = groundGradient;
            bgCtx.fillRect(0, bgCanvas.height * 0.6, bgCanvas.width, bgCanvas.height * 0.4);
            
            // Draw rolling hills
            bgCtx.fillStyle = '#65a30d';
            bgCtx.beginPath();
            bgCtx.moveTo(0, bgCanvas.height * 0.65);
            for (let x = 0; x < bgCanvas.width; x += 50) {
                const y = bgCanvas.height * 0.65 + Math.sin(x * 0.01 + Date.now() * 0.0001) * 30;
                bgCtx.lineTo(x, y);
            }
            bgCtx.lineTo(bgCanvas.width, bgCanvas.height);
            bgCtx.lineTo(0, bgCanvas.height);
            bgCtx.fill();
            
            // Draw animated grass blades
            const time = Date.now() * 0.001;
            grassBlades.forEach(blade => {
                const sway = Math.sin(time * blade.swaySpeed + blade.swayOffset) * 8;
                
                bgCtx.save();
                bgCtx.translate(blade.x, blade.y);
                
                const gradient = bgCtx.createLinearGradient(0, 0, 0, -blade.height);
                gradient.addColorStop(0, `rgb(${blade.baseColor.r * 0.7}, ${blade.baseColor.g * 0.7}, ${blade.baseColor.b * 0.7})`);
                gradient.addColorStop(1, `rgb(${blade.baseColor.r}, ${blade.baseColor.g}, ${blade.baseColor.b})`);
                
                bgCtx.fillStyle = gradient;
                bgCtx.beginPath();
                bgCtx.moveTo(0, 0);
                bgCtx.quadraticCurveTo(sway / 2, -blade.height / 2, sway, -blade.height);
                bgCtx.lineTo(sway - blade.width, -blade.height);
                bgCtx.quadraticCurveTo(sway / 2, -blade.height / 2, -blade.width, 0);
                bgCtx.closePath();
                bgCtx.fill();
                
                bgCtx.restore();
            });
            
            // Draw and animate birds
            birds.forEach(bird => {
                if (!bird.active) {
                    if (Math.random() < 0.001) bird.active = true;
                    return;
                }
                
                bird.wingPhase += 0.15;
                const wingUp = Math.sin(bird.wingPhase) > 0;
                
                bgCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                bgCtx.font = '20px Arial';
                bgCtx.fillText(wingUp ? '🦅' : '🦆', bird.x, bird.y);
                
                bird.x += bird.speed;
                bird.y += Math.sin(bird.x * 0.01) * 0.5;
                
                if (bird.x > bgCanvas.width + 50) {
                    bird.x = -50;
                    bird.y = 100 + Math.random() * 200;
                    bird.active = Math.random() > 0.3;
                }
            });
            
            requestAnimationFrame(drawBackground);
        }

        // ==========================================
        // THREE.JS 3D EARTH GLOBE
        // ==========================================
        let scene, camera, renderer, earth, earthContainer;
        let globeRotationSpeed = 0.001;
        
        function initEarthGlobe() {
            earthContainer = document.getElementById('earth-container');
            
            // Scene setup
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.z = 2.5;
            
            // Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor(0x000000, 0);
            earthContainer.appendChild(renderer.domElement);
            
            // Create Earth sphere
            const geometry = new THREE.SphereGeometry(0.8, 64, 64);
            
            // Create Earth texture using canvas
            const textureCanvas = document.createElement('canvas');
            textureCanvas.width = 2048;
            textureCanvas.height = 1024;
            const texCtx = textureCanvas.getContext('2d');
            
            // Draw ocean (blue)
            texCtx.fillStyle = '#0066cc';
            texCtx.fillRect(0, 0, 2048, 1024);
            
            // Draw continents (green) - simplified but recognizable shapes
            texCtx.fillStyle = '#228B22';
            
            // North America
            texCtx.beginPath();
            texCtx.moveTo(300, 200);
            texCtx.bezierCurveTo(250, 150, 350, 180, 400, 220);
            texCtx.bezierCurveTo(450, 300, 420, 400, 380, 450);
            texCtx.bezierCurveTo(320, 420, 280, 350, 300, 200);
            texCtx.fill();
            
            // South America
            texCtx.beginPath();
            texCtx.moveTo(450, 500);
            texCtx.bezierCurveTo(480, 550, 490, 650, 470, 700);
            texCtx.bezierCurveTo(450, 750, 400, 740, 380, 680);
            texCtx.bezierCurveTo(370, 600, 400, 520, 450, 500);
            texCtx.fill();
            
            // Europe
            texCtx.beginPath();
            texCtx.moveTo(950, 220);
            texCtx.bezierCurveTo(1000, 200, 1050, 240, 1080, 280);
            texCtx.bezierCurveTo(1070, 320, 1020, 340, 970, 320);
            texCtx.bezierCurveTo(940, 280, 930, 240, 950, 220);
            texCtx.fill();
            
            // Africa
            texCtx.beginPath();
            texCtx.moveTo(1000, 350);
            texCtx.bezierCurveTo(1050, 360, 1100, 400, 1120, 480);
            texCtx.bezierCurveTo(1130, 600, 1080, 700, 1020, 740);
            texCtx.bezierCurveTo(950, 720, 920, 650, 940, 550);
            texCtx.bezierCurveTo(960, 450, 970, 370, 1000, 350);
            texCtx.fill();
            
            // Asia
            texCtx.beginPath();
            texCtx.moveTo(1200, 180);
            texCtx.bezierCurveTo(1350, 160, 1500, 200, 1600, 280);
            texCtx.bezierCurveTo(1650, 350, 1620, 450, 1550, 500);
            texCtx.bezierCurveTo(1450, 520, 1350, 480, 1280, 420);
            texCtx.bezierCurveTo(1220, 350, 1180, 240, 1200, 180);
            texCtx.fill();
            
            // Australia
            texCtx.beginPath();
            texCtx.moveTo(1550, 620);
            texCtx.bezierCurveTo(1620, 630, 1680, 670, 1690, 720);
            texCtx.bezierCurveTo(1680, 760, 1630, 780, 1580, 770);
            texCtx.bezierCurveTo(1530, 750, 1510, 700, 1520, 660);
            texCtx.bezierCurveTo(1530, 635, 1540, 625, 1550, 620);
            texCtx.fill();
            
            // Add texture detail (darker greens for terrain)
            texCtx.fillStyle = '#1a6b1a';
            for (let i = 0; i < 500; i++) {
                const x = Math.random() * 2048;
                const y = Math.random() * 1024;
                texCtx.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
            }
            
            // Create texture from canvas
            const texture = new THREE.CanvasTexture(textureCanvas);
            
            // Materials with realistic properties
            const material = new THREE.MeshPhongMaterial({
                map: texture,
                shininess: 5,
                specular: new THREE.Color(0x333333)
            });
            
            earth = new THREE.Mesh(geometry, material);
            scene.add(earth);
            
            // Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(5, 3, 5);
            scene.add(directionalLight);
            
            // Add subtle atmospheric glow
            const glowGeometry = new THREE.SphereGeometry(0.85, 64, 64);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0x0088ff,
                transparent: true,
                opacity: 0.15,
                side: THREE.BackSide
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            scene.add(glow);
            
            animateEarth();
        }
        
        function animateEarth() {
            requestAnimationFrame(animateEarth);
            
            if (earth) {
                earth.rotation.y += globeRotationSpeed;
            }
            
            renderer.render(scene, camera);
        }
        
        window.addEventListener('resize', () => {
            if (camera && renderer) {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
            resizeBgCanvas();
        });

        // ==========================================
        // GAME DATA & STATE
        // ==========================================
        // ==========================================
        // GAME DATA & STATE
        // ==========================================
        
        const starterLanguages = [
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Spanish' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'it', name: 'Italian' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'zh', name: 'Chinese' },
            { code: 'ja', name: 'Japanese' },
            { code: 'ko', name: 'Korean' },
            { code: 'ar', name: 'Arabic' }
        ];

        const unlockableLanguages = [
            { code: 'ru', name: 'Russian' },
            { code: 'hi', name: 'Hindi' },
            { code: 'tr', name: 'Turkish' },
            { code: 'nl', name: 'Dutch' },
            { code: 'sv', name: 'Swedish' },
            { code: 'pl', name: 'Polish' },
            { code: 'vi', name: 'Vietnamese' },
            { code: 'th', name: 'Thai' },
            { code: 'id', name: 'Indonesian' },
            { code: 'uk', name: 'Ukrainian' },
            { code: 'ro', name: 'Romanian' },
            { code: 'el', name: 'Greek' },
            { code: 'cs', name: 'Czech' },
            { code: 'da', name: 'Danish' },
            { code: 'fi', name: 'Finnish' },
            { code: 'hu', name: 'Hungarian' },
            { code: 'he', name: 'Hebrew' },
            { code: 'no', name: 'Norwegian' },
            { code: 'sk', name: 'Slovak' },
            { code: 'bg', name: 'Bulgarian' }
        ];

        const starterAvatars = ['🌍', '🌎', '🌏', '🗺️', '🧭', '✈️', '🚀', '🛸'];
        const unlockableAvatars = ['👽', '🤖', '🦾', '🦿', '🎯', '⚡', '🔥', '⭐', '💎', '🏆', '👑', '🎨'];

        const badges = [
            { emoji: '🎯', name: 'First Translation', requirement: 1 },
            { emoji: '💯', name: '100 XP Master', requirement: 100 },
            { emoji: '🔥', name: '7 Day Streak', requirement: 7 },
            { emoji: '📚', name: 'Polyglot', requirement: 'unlockAll' },
            { emoji: '🏆', name: '1000 XP Legend', requirement: 1000 },
            { emoji: '⚡', name: 'Speed Demon', requirement: 'special' }
        ];

        // Game State
        let gameState = {
            profile: {
                name: 'Translator',
                avatar: '🌍'
            },
            xp: 0,
            streak: {
                days: 0,
                lastLogin: null
            },
            dailyTranslations: 0,
            unlockedLanguages: [...starterLanguages],
            unlockedAvatars: [...starterAvatars],
            badges: [],
            translationLog: []
        };

        // Load saved data
        function loadGameState() {
            const saved = localStorage.getItem('globalLingoState');
            if (saved) {
                gameState = JSON.parse(saved);
                checkDailyLogin();
            }
        }

        function saveGameState() {
            localStorage.setItem('globalLingoState', JSON.stringify(gameState));
        }

        function checkDailyLogin() {
            const today = new Date().toDateString();
            const lastLogin = gameState.streak.lastLogin;
            
            if (lastLogin !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toDateString();
                
                if (lastLogin === yesterdayStr) {
                    // Consecutive day
                    gameState.streak.days++;
                    const loginXP = 10 + Math.max(0, gameState.streak.days - 7);
                    gameState.xp += loginXP;
                    showNotification(`🎉 Day ${gameState.streak.days} Streak! +${loginXP} XP`);
                } else if (lastLogin) {
                    // Streak broken
                    gameState.streak.days = 1;
                    gameState.xp += 10;
                    showNotification('Streak reset. Starting fresh! +10 XP');
                } else {
                    // First login
                    gameState.streak.days = 1;
                    gameState.xp += 10;
                }
                
                gameState.streak.lastLogin = today;
                gameState.dailyTranslations = 0;
                checkBadges();
                saveGameState();
            }
        }

        function showNotification(message) {
            // Simple notification - could be enhanced
            console.log(message);
        }

        // Initialize App
        function initializeApp() {
            document.getElementById('startup-screen').classList.add('hidden');
            document.getElementById('loading-screen').classList.remove('hidden');
            
            const loadingTexts = [
                'Loading Global Lingo...',
                'Gathering Languages...',
                'Initializing Translator...',
                'Connecting to Satellites...',
                'Ready to Translate!'
            ];
            
            let progress = 0;
            const interval = setInterval(() => {
                progress += 20;
                document.getElementById('loading-fill').style.width = progress + '%';
                document.getElementById('loading-text').textContent = loadingTexts[progress / 20 - 1];
                
                if (progress >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        document.getElementById('loading-screen').classList.add('hidden');
                        loadGameState();
                        if (!localStorage.getItem('globalLingoState')) {
                            document.getElementById('profile-setup').classList.remove('hidden');
                            populateAvatarGrid('avatar-grid', false);
                        } else {
                            showMainApp();
                        }
                    }, 500);
                }
            }, 600);
        }

        function populateAvatarGrid(gridId, includeUnlocked) {
            const grid = document.getElementById(gridId);
            grid.innerHTML = '';
            
            starterAvatars.forEach(avatar => {
                const div = document.createElement('div');
                div.className = 'avatar-option';
                div.textContent = avatar;
                div.onclick = () => selectAvatar(avatar, gridId);
                grid.appendChild(div);
            });
            
            if (includeUnlocked) {
                unlockableAvatars.forEach(avatar => {
                    const div = document.createElement('div');
                    div.className = gameState.unlockedAvatars.includes(avatar) ? 'avatar-option' : 'avatar-option locked';
                    div.textContent = avatar;
                    if (gameState.unlockedAvatars.includes(avatar)) {
                        div.onclick = () => selectAvatar(avatar, gridId);
                    }
                    grid.appendChild(div);
                });
            }
        }

        let selectedAvatar = '🌍';
        function selectAvatar(avatar, gridId) {
            selectedAvatar = avatar;
            document.querySelectorAll(`#${gridId} .avatar-option`).forEach(el => {
                el.classList.remove('selected');
            });
            event.target.classList.add('selected');
        }

        function saveProfile() {
            const username = document.getElementById('username-input').value.trim();
            if (!username) {
                alert('Please enter a name!');
                return;
            }
            
            gameState.profile.name = username;
            gameState.profile.avatar = selectedAvatar;
            gameState.streak.lastLogin = new Date().toDateString();
            gameState.streak.days = 1;
            gameState.xp = 10; // Welcome bonus
            saveGameState();
            showMainApp();
        }

        function showMainApp() {
            document.getElementById('profile-setup').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            
            // Activate animated background
            backgroundActive = true;
            resizeBgCanvas();
            drawBackground();
            
            // Initialize and show Three.js Earth
            document.getElementById('earth-container').classList.add('active');
            initEarthGlobe();
            
            updateUI();
            populateLanguageSelects();
            populateBadges();
        }

        function updateUI() {
            document.getElementById('profile-avatar').textContent = gameState.profile.avatar;
            document.getElementById('profile-name').textContent = gameState.profile.name;
            document.getElementById('total-xp').textContent = gameState.xp;
            document.getElementById('streak-days').textContent = gameState.streak.days;
            document.getElementById('daily-translations').textContent = `${gameState.dailyTranslations} / 2`;
            
            // Check for language unlock
            if (gameState.xp >= 100 && gameState.unlockedLanguages.length === starterLanguages.length) {
                gameState.unlockedLanguages = [...starterLanguages, ...unlockableLanguages];
                gameState.unlockedAvatars = [...starterAvatars, ...unlockableAvatars.slice(0, 6)];
                populateLanguageSelects();
                showNotification('🎉 All Languages Unlocked!');
                checkBadges();
            }
            
            // Update translation log
            const logContainer = document.getElementById('translation-log');
            logContainer.innerHTML = '';
            gameState.translationLog.slice().reverse().forEach(log => {
                const entry = document.createElement('div');
                entry.className = 'log-entry';
                entry.innerHTML = `
                    <div class="log-date">${log.date}</div>
                    <div class="log-translation">${log.from} → ${log.to}: "${log.original}" = "${log.translated}"</div>
                `;
                logContainer.appendChild(entry);
            });
        }

        function populateLanguageSelects() {
            const fromSelect = document.getElementById('from-lang');
            const toSelect = document.getElementById('to-lang');
            
            fromSelect.innerHTML = '';
            toSelect.innerHTML = '';
            
            gameState.unlockedLanguages.forEach(lang => {
                const option1 = document.createElement('option');
                option1.value = lang.code;
                option1.textContent = lang.name;
                fromSelect.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = lang.code;
                option2.textContent = lang.name;
                toSelect.appendChild(option2);
            });
            
            // Set default
            toSelect.value = 'es';
        }

        function populateBadges() {
            const grid = document.getElementById('badges-grid');
            grid.innerHTML = '';
            
            badges.forEach(badge => {
                const div = document.createElement('div');
                const earned = checkBadgeEarned(badge);
                div.className = earned ? 'badge' : 'badge locked';
                div.innerHTML = `
                    ${badge.emoji}
                    <div class="badge-tooltip">${badge.name}</div>
                `;
                grid.appendChild(div);
            });
        }

        function checkBadgeEarned(badge) {
            if (badge.requirement === 'unlockAll') {
                return gameState.unlockedLanguages.length > starterLanguages.length;
            }
            if (badge.requirement === 'special') {
                return false; // Special achievements
            }
            if (badge.name.includes('Streak')) {
                return gameState.streak.days >= badge.requirement;
            }
            if (badge.name.includes('XP')) {
                return gameState.xp >= badge.requirement;
            }
            if (badge.name.includes('Translation')) {
                return gameState.translationLog.length >= badge.requirement;
            }
            return false;
        }

        function checkBadges() {
            populateBadges();
        }

        // Comprehensive Offline Translation System
        async function translateText() {
            const inputText = document.getElementById('input-text').value.trim();
            if (!inputText) {
                alert('Please enter text to translate!');
                return;
            }
            
            const fromLang = document.getElementById('from-lang').value;
            const toLang = document.getElementById('to-lang').value;
            
            if (fromLang === toLang) {
                alert('Please select different languages!');
                return;
            }
            
            // Animate globe - 720 degree spin
            const globe = document.getElementById('globe-button');
            globe.classList.add('spinning');
            
            setTimeout(async () => {
                // Use comprehensive offline translation
                const translated = getFallbackTranslation(inputText, toLang);
                
                globe.classList.remove('spinning');
                
                document.getElementById('output-text').value = translated;
                
                // Calculate XP
                const wordCount = inputText.trim().split(/\s+/).length;
                const xpGained = wordCount >= 4 ? 10 : 5;
                gameState.xp += xpGained;
                gameState.dailyTranslations++;
                
                // Get definition and show results
                await showResults(inputText, translated, toLang, xpGained);
                
                // Log translation
                const fromLangName = gameState.unlockedLanguages.find(l => l.code === fromLang).name;
                const toLangName = gameState.unlockedLanguages.find(l => l.code === toLang).name;
                gameState.translationLog.push({
                    date: new Date().toLocaleString(),
                    from: fromLangName,
                    to: toLangName,
                    original: inputText,
                    translated: translated
                });
                
                checkBadges();
                saveGameState();
                updateUI();
            }, 1200);
        }

        // Fallback translation dictionary for when API is unavailable
        function getFallbackTranslation(text, toLang) {
            const translations = {
                // Greetings
                'hello': { es: 'hola', fr: 'bonjour', de: 'hallo', it: 'ciao', pt: 'olá', zh: '你好', ja: 'こんにちは', ko: '안녕하세요', ar: 'مرحبا', ru: 'привет', hi: 'नमस्ते', tr: 'merhaba', nl: 'hallo', sv: 'hej', pl: 'cześć', vi: 'xin chào', th: 'สวัสดี', id: 'halo', uk: 'привіт', ro: 'salut', el: 'γεια', cs: 'ahoj', da: 'hej', fi: 'hei', hu: 'szia', he: 'שלום', no: 'hei', sk: 'ahoj', bg: 'здравей' },
                'hi': { es: 'hola', fr: 'salut', de: 'hallo', it: 'ciao', pt: 'oi', zh: '嗨', ja: 'やあ', ko: '안녕', ar: 'مرحبا', ru: 'привет', hi: 'नमस्ते', tr: 'selam', nl: 'hoi', sv: 'hej', pl: 'cześć' },
                'goodbye': { es: 'adiós', fr: 'au revoir', de: 'auf wiedersehen', it: 'arrivederci', pt: 'adeus', zh: '再见', ja: 'さようなら', ko: '안녕', ar: 'وداعا', ru: 'до свидания', hi: 'अलविदा', tr: 'güle güle', nl: 'tot ziens', sv: 'hejdå', pl: 'do widzenia' },
                'bye': { es: 'adiós', fr: 'au revoir', de: 'tschüss', it: 'ciao', pt: 'tchau', zh: '拜拜', ja: 'バイバイ', ko: '잘가', ar: 'وداعا', ru: 'пока', hi: 'अलविदा', tr: 'güle güle', nl: 'doei', sv: 'hej då', pl: 'cześć' },
                'thank you': { es: 'gracias', fr: 'merci', de: 'danke', it: 'grazie', pt: 'obrigado', zh: '谢谢', ja: 'ありがとう', ko: '감사합니다', ar: 'شكرا', ru: 'спасибо', hi: 'धन्यवाद', tr: 'teşekkür ederim', nl: 'dank je', sv: 'tack', pl: 'dziękuję' },
                'thanks': { es: 'gracias', fr: 'merci', de: 'danke', it: 'grazie', pt: 'obrigado', zh: '谢谢', ja: 'ありがとう', ko: '고마워', ar: 'شكرا', ru: 'спасибо', hi: 'धन्यवाद', tr: 'teşekkürler', nl: 'bedankt', sv: 'tack', pl: 'dzięki' },
                'yes': { es: 'sí', fr: 'oui', de: 'ja', it: 'sì', pt: 'sim', zh: '是', ja: 'はい', ko: '네', ar: 'نعم', ru: 'да', hi: 'हाँ', tr: 'evet', nl: 'ja', sv: 'ja', pl: 'tak' },
                'no': { es: 'no', fr: 'non', de: 'nein', it: 'no', pt: 'não', zh: '不', ja: 'いいえ', ko: '아니요', ar: 'لا', ru: 'нет', hi: 'नहीं', tr: 'hayır', nl: 'nee', sv: 'nej', pl: 'nie' },
                'please': { es: 'por favor', fr: 's\'il vous plaît', de: 'bitte', it: 'per favore', pt: 'por favor', zh: '请', ja: 'お願いします', ko: '제발', ar: 'من فضلك', ru: 'пожалуйста', hi: 'कृपया', tr: 'lütfen', nl: 'alsjeblieft', sv: 'snälla' },
                'sorry': { es: 'lo siento', fr: 'désolé', de: 'entschuldigung', it: 'scusa', pt: 'desculpe', zh: '对不起', ja: 'ごめんなさい', ko: '미안해요', ar: 'آسف', ru: 'извини', hi: 'माफ़ करना', tr: 'özür dilerim', nl: 'sorry', sv: 'förlåt', pl: 'przepraszam' },
                
                // Time & common phrases  
                'good morning': { es: 'buenos días', fr: 'bonjour', de: 'guten morgen', it: 'buongiorno', pt: 'bom dia', zh: '早上好', ja: 'おはよう', ko: '좋은 아침', ar: 'صباح الخير', ru: 'доброе утро', hi: 'सुप्रभात', tr: 'günaydın' },
                'good night': { es: 'buenas noches', fr: 'bonne nuit', de: 'gute nacht', it: 'buona notte', pt: 'boa noite', zh: '晚安', ja: 'おやすみ', ko: '안녕히 주무세요', ar: 'تصبح على خير', ru: 'спокойной ночи', hi: 'शुभ रात्रि' },
                'good afternoon': { es: 'buenas tardes', fr: 'bon après-midi', de: 'guten tag', it: 'buon pomeriggio', pt: 'boa tarde', zh: '下午好', ja: 'こんにちは', ko: '좋은 오후', ar: 'مساء الخير', ru: 'добрый день', hi: 'शुभ दोपहर', tr: 'iyi günler' },
                'see you later': { es: 'hasta luego', fr: 'à plus tard', de: 'bis später', it: 'a dopo', pt: 'até logo', zh: '回头见', ja: 'また後で', ko: '나중에 봐요', ar: 'أراك لاحقا', ru: 'увидимся позже', hi: 'बाद में मिलते हैं' },
                'see you': { es: 'nos vemos', fr: 'à bientôt', de: 'bis dann', it: 'ci vediamo', pt: 'até mais', zh: '再见', ja: 'またね', ko: '또 봐', ar: 'أراك', ru: 'увидимся', hi: 'मिलते हैं', tr: 'görüşürüz' },
                'how are you': { es: '¿cómo estás?', fr: 'comment allez-vous?', de: 'wie geht es dir?', it: 'come stai?', pt: 'como vai?', zh: '你好吗?', ja: '元気ですか?', ko: '어떻게 지내세요?', ar: 'كيف حالك؟', ru: 'как дела?' },
                'welcome': { es: 'bienvenido', fr: 'bienvenue', de: 'willkommen', it: 'benvenuto', pt: 'bem-vindo', zh: '欢迎', ja: 'ようこそ', ko: '환영합니다', ar: 'أهلا بك', ru: 'добро пожаловать', hi: 'स्वागत' },
                'i love you': { es: 'te amo', fr: 'je t\'aime', de: 'ich liebe dich', it: 'ti amo', pt: 'eu te amo', zh: '我爱你', ja: '愛してる', ko: '사랑해', ar: 'أحبك', ru: 'я тебя люблю', hi: 'मैं तुमसे प्यार करता हूँ', tr: 'seni seviyorum' },
                
                // Questions  
                'what': { es: 'qué', fr: 'quoi', de: 'was', it: 'cosa', pt: 'o que', zh: '什么', ja: '何', ko: '무엇', ar: 'ماذا', ru: 'что', hi: 'क्या', tr: 'ne', nl: 'wat', sv: 'vad', pl: 'co' },
                'what are you doing': { es: 'qué estás haciendo', fr: 'que fais-tu', de: 'was machst du', it: 'cosa stai facendo', pt: 'o que você está fazendo', zh: '你在做什么', ja: '何してるの', ko: '뭐하고 있어', ar: 'ماذا تفعل', ru: 'что ты делаешь', hi: 'तुम क्या कर रहे हो', tr: 'ne yapıyorsun' },
                'where': { es: 'dónde', fr: 'où', de: 'wo', it: 'dove', pt: 'onde', zh: '哪里', ja: 'どこ', ko: '어디', ar: 'أين', ru: 'где', hi: 'कहाँ', tr: 'nerede', nl: 'waar', sv: 'var', pl: 'gdzie' },
                'when': { es: 'cuándo', fr: 'quand', de: 'wann', it: 'quando', pt: 'quando', zh: '什么时候', ja: 'いつ', ko: '언제', ar: 'متى', ru: 'когда', hi: 'कब', tr: 'ne zaman', nl: 'wanneer', sv: 'när', pl: 'kiedy' },
                'why': { es: 'por qué', fr: 'pourquoi', de: 'warum', it: 'perché', pt: 'por que', zh: '为什么', ja: 'なぜ', ko: '왜', ar: 'لماذا', ru: 'почему', hi: 'क्यों', tr: 'neden', nl: 'waarom', sv: 'varför', pl: 'dlaczego' },
                'how': { es: 'cómo', fr: 'comment', de: 'wie', it: 'come', pt: 'como', zh: '怎么', ja: 'どうやって', ko: '어떻게', ar: 'كيف', ru: 'как', hi: 'कैसे', tr: 'nasıl', nl: 'hoe', sv: 'hur', pl: 'jak' },
                'who': { es: 'quién', fr: 'qui', de: 'wer', it: 'chi', pt: 'quem', zh: '谁', ja: '誰', ko: '누구', ar: 'من', ru: 'кто', hi: 'कौन', tr: 'kim', nl: 'wie', sv: 'vem', pl: 'kto' },
                
                // Family
                'son': { es: 'hijo', fr: 'fils', de: 'sohn', it: 'figlio', pt: 'filho', zh: '儿子', ja: '息子', ko: '아들', ar: 'ابن', ru: 'сын', hi: 'बेटा', tr: 'oğul', nl: 'zoon', sv: 'son', pl: 'syn', vi: 'con trai', th: 'ลูกชาย', id: 'anak laki-laki' },
                'daughter': { es: 'hija', fr: 'fille', de: 'tochter', it: 'figlia', pt: 'filha', zh: '女儿', ja: '娘', ko: '딸', ar: 'ابنة', ru: 'дочь', hi: 'बेटी', tr: 'kız', nl: 'dochter', sv: 'dotter', pl: 'córka', vi: 'con gái', th: 'ลูกสาว', id: 'anak perempuan' },
                'mother': { es: 'madre', fr: 'mère', de: 'mutter', it: 'madre', pt: 'mãe', zh: '母亲', ja: '母', ko: '어머니', ar: 'أم', ru: 'мать', hi: 'माँ', tr: 'anne', nl: 'moeder', sv: 'mamma', pl: 'matka', vi: 'mẹ', th: 'แม่', id: 'ibu' },
                'father': { es: 'padre', fr: 'père', de: 'vater', it: 'padre', pt: 'pai', zh: '父亲', ja: '父', ko: '아버지', ar: 'أب', ru: 'отец', hi: 'पिता', tr: 'baba', nl: 'vader', sv: 'pappa', pl: 'ojciec', vi: 'cha', th: 'พ่อ', id: 'ayah' },
                'brother': { es: 'hermano', fr: 'frère', de: 'bruder', it: 'fratello', pt: 'irmão', zh: '兄弟', ja: '兄弟', ko: '형제', ar: 'أخ', ru: 'брат', hi: 'भाई', tr: 'erkek kardeş', nl: 'broer', sv: 'bror', pl: 'brat', vi: 'anh trai', th: 'พี่ชาย', id: 'saudara laki-laki' },
                'sister': { es: 'hermana', fr: 'sœur', de: 'schwester', it: 'sorella', pt: 'irmã', zh: '姐妹', ja: '姉妹', ko: '자매', ar: 'أخت', ru: 'сестра', hi: 'बहन', tr: 'kız kardeş', nl: 'zus', sv: 'syster', pl: 'siostra', vi: 'chị gái', th: 'พี่สาว', id: 'saudara perempuan' },
                'parent': { es: 'padre', fr: 'parent', de: 'elternteil', it: 'genitore', pt: 'pai', zh: '父母', ja: '親', ko: '부모', ar: 'والد', ru: 'родитель', hi: 'माता-पिता', tr: 'ebeveyn', nl: 'ouder', sv: 'förälder', pl: 'rodzic' },
                'child': { es: 'niño', fr: 'enfant', de: 'kind', it: 'bambino', pt: 'criança', zh: '孩子', ja: '子供', ko: '아이', ar: 'طفل', ru: 'ребенок', hi: 'बच्चा', tr: 'çocuk', nl: 'kind', sv: 'barn', pl: 'dziecko' },
                'baby': { es: 'bebé', fr: 'bébé', de: 'baby', it: 'bambino', pt: 'bebê', zh: '婴儿', ja: '赤ちゃん', ko: '아기', ar: 'طفل رضيع', ru: 'младенец', hi: 'शिशु', tr: 'bebek', nl: 'baby', sv: 'bebis', pl: 'niemowlę' },
                
                // Common nouns
                'car': { es: 'coche', fr: 'voiture', de: 'auto', it: 'macchina', pt: 'carro', zh: '车', ja: '車', ko: '차', ar: 'سيارة', ru: 'машина', hi: 'कार', tr: 'araba', nl: 'auto', sv: 'bil', pl: 'samochód', vi: 'xe hơi', th: 'รถยนต์', id: 'mobil' },
                'house': { es: 'casa', fr: 'maison', de: 'haus', it: 'casa', pt: 'casa', zh: '房子', ja: '家', ko: '집', ar: 'بيت', ru: 'дом', hi: 'घर', tr: 'ev', nl: 'huis', sv: 'hus', pl: 'dom' },
                'food': { es: 'comida', fr: 'nourriture', de: 'essen', it: 'cibo', pt: 'comida', zh: '食物', ja: '食べ物', ko: '음식', ar: 'طعام', ru: 'еда', hi: 'भोजन', tr: 'yemek', nl: 'eten', sv: 'mat', pl: 'jedzenie' },
                'water': { es: 'agua', fr: 'eau', de: 'wasser', it: 'acqua', pt: 'água', zh: '水', ja: '水', ko: '물', ar: 'ماء', ru: 'вода', hi: 'पानी', tr: 'su', nl: 'water', sv: 'vatten', pl: 'woda' },
                'book': { es: 'libro', fr: 'livre', de: 'buch', it: 'libro', pt: 'livro', zh: '书', ja: '本', ko: '책', ar: 'كتاب', ru: 'книга', hi: 'किताब', tr: 'kitap', nl: 'boek', sv: 'bok', pl: 'książka' },
                'phone': { es: 'teléfono', fr: 'téléphone', de: 'telefon', it: 'telefono', pt: 'telefone', zh: '电话', ja: '電話', ko: '전화', ar: 'هاتف', ru: 'телефон', hi: 'फ़ोन', tr: 'telefon', nl: 'telefoon', sv: 'telefon', pl: 'telefon' },
                'computer': { es: 'computadora', fr: 'ordinateur', de: 'computer', it: 'computer', pt: 'computador', zh: '电脑', ja: 'コンピュータ', ko: '컴퓨터', ar: 'حاسوب', ru: 'компьютер', hi: 'कंप्यूटर', tr: 'bilgisayar', nl: 'computer', sv: 'dator', pl: 'komputer' },
                'money': { es: 'dinero', fr: 'argent', de: 'geld', it: 'soldi', pt: 'dinheiro', zh: '钱', ja: 'お金', ko: '돈', ar: 'مال', ru: 'деньги', hi: 'पैसा', tr: 'para', nl: 'geld', sv: 'pengar', pl: 'pieniądze' },
                
                // Emotions & concepts  
                'love': { es: 'amor', fr: 'amour', de: 'liebe', it: 'amore', pt: 'amor', zh: '爱', ja: '愛', ko: '사랑', ar: 'حب', ru: 'любовь', hi: 'प्यार', tr: 'aşk', nl: 'liefde', sv: 'kärlek', pl: 'miłość' },
                'friend': { es: 'amigo', fr: 'ami', de: 'freund', it: 'amico', pt: 'amigo', zh: '朋友', ja: '友達', ko: '친구', ar: 'صديق', ru: 'друг', hi: 'दोस्त', tr: 'arkadaş', nl: 'vriend', sv: 'vän', pl: 'przyjaciel' },
                'family': { es: 'familia', fr: 'famille', de: 'familie', it: 'famiglia', pt: 'família', zh: '家庭', ja: '家族', ko: '가족', ar: 'عائلة', ru: 'семья', hi: 'परिवार', tr: 'aile', nl: 'familie', sv: 'familj', pl: 'rodzina' },
                'happy': { es: 'feliz', fr: 'heureux', de: 'glücklich', it: 'felice', pt: 'feliz', zh: '快乐', ja: '幸せ', ko: '행복한', ar: 'سعيد', ru: 'счастливый', hi: 'खुश', tr: 'mutlu', nl: 'gelukkig', sv: 'lycklig', pl: 'szczęśliwy' },
                'sad': { es: 'triste', fr: 'triste', de: 'traurig', it: 'triste', pt: 'triste', zh: '悲伤', ja: '悲しい', ko: '슬픈', ar: 'حزين', ru: 'грустный', hi: 'दुखी', tr: 'üzgün', nl: 'verdrietig', sv: 'ledsen', pl: 'smutny' },
                'world': { es: 'mundo', fr: 'monde', de: 'welt', it: 'mondo', pt: 'mundo', zh: '世界', ja: '世界', ko: '세계', ar: 'عالم', ru: 'мир', hi: 'दुनिया', tr: 'dünya', nl: 'wereld', sv: 'värld', pl: 'świat' },
                'peace': { es: 'paz', fr: 'paix', de: 'frieden', it: 'pace', pt: 'paz', zh: '和平', ja: '平和', ko: '평화', ar: 'سلام', ru: 'мир', hi: 'शांति', tr: 'barış', nl: 'vrede', sv: 'fred', pl: 'pokój' },
                'life': { es: 'vida', fr: 'vie', de: 'leben', it: 'vita', pt: 'vida', zh: '生活', ja: '人生', ko: '생활', ar: 'حياة', ru: 'жизнь', hi: 'जीवन', tr: 'hayat', nl: 'leven', sv: 'liv', pl: 'życie' },
                'time': { es: 'tiempo', fr: 'temps', de: 'zeit', it: 'tempo', pt: 'tempo', zh: '时间', ja: '時間', ko: '시간', ar: 'وقت', ru: 'время', hi: 'समय', tr: 'zaman', nl: 'tijd', sv: 'tid', pl: 'czas' },
                'day': { es: 'día', fr: 'jour', de: 'tag', it: 'giorno', pt: 'dia', zh: '天', ja: '日', ko: '날', ar: 'يوم', ru: 'день', hi: 'दिन', tr: 'gün', nl: 'dag', sv: 'dag', pl: 'dzień' },
                'night': { es: 'noche', fr: 'nuit', de: 'nacht', it: 'notte', pt: 'noite', zh: '夜晚', ja: '夜', ko: '밤', ar: 'ليلة', ru: 'ночь', hi: 'रात', tr: 'gece', nl: 'nacht', sv: 'natt', pl: 'noc' },
                
                // Actions
                'eat': { es: 'comer', fr: 'manger', de: 'essen', it: 'mangiare', pt: 'comer', zh: '吃', ja: '食べる', ko: '먹다', ar: 'يأكل', ru: 'есть', hi: 'खाना', tr: 'yemek', nl: 'eten', sv: 'äta', pl: 'jeść' },
                'drink': { es: 'beber', fr: 'boire', de: 'trinken', it: 'bere', pt: 'beber', zh: '喝', ja: '飲む', ko: '마시다', ar: 'يشرب', ru: 'пить', hi: 'पीना', tr: 'içmek', nl: 'drinken', sv: 'dricka', pl: 'pić' },
                'sleep': { es: 'dormir', fr: 'dormir', de: 'schlafen', it: 'dormire', pt: 'dormir', zh: '睡觉', ja: '寝る', ko: '자다', ar: 'ينام', ru: 'спать', hi: 'सोना', tr: 'uyumak', nl: 'slapen', sv: 'sova', pl: 'spać' },
                'walk': { es: 'caminar', fr: 'marcher', de: 'gehen', it: 'camminare', pt: 'andar', zh: '走', ja: '歩く', ko: '걷다', ar: 'يمشي', ru: 'ходить', hi: 'चलना', tr: 'yürümek', nl: 'lopen', sv: 'gå', pl: 'chodzić' },
                'run': { es: 'correr', fr: 'courir', de: 'laufen', it: 'correre', pt: 'correr', zh: '跑', ja: '走る', ko: '달리다', ar: 'يركض', ru: 'бегать', hi: 'दौड़ना', tr: 'koşmak', nl: 'rennen', sv: 'springa', pl: 'biegać' },
                'work': { es: 'trabajar', fr: 'travailler', de: 'arbeiten', it: 'lavorare', pt: 'trabalhar', zh: '工作', ja: '働く', ko: '일하다', ar: 'يعمل', ru: 'работать', hi: 'काम करना', tr: 'çalışmak', nl: 'werken', sv: 'arbeta', pl: 'pracować' },
                'play': { es: 'jugar', fr: 'jouer', de: 'spielen', it: 'giocare', pt: 'jogar', zh: '玩', ja: '遊ぶ', ko: '놀다', ar: 'يلعب', ru: 'играть', hi: 'खेलना', tr: 'oynamak', nl: 'spelen', sv: 'spela', pl: 'grać' },
                'learn': { es: 'aprender', fr: 'apprendre', de: 'lernen', it: 'imparare', pt: 'aprender', zh: '学习', ja: '学ぶ', ko: '배우다', ar: 'يتعلم', ru: 'учиться', hi: 'सीखना', tr: 'öğrenmek', nl: 'leren', sv: 'lära', pl: 'uczyć się' },
                'read': { es: 'leer', fr: 'lire', de: 'lesen', it: 'leggere', pt: 'ler', zh: '读', ja: '読む', ko: '읽다', ar: 'يقرأ', ru: 'читать', hi: 'पढ़ना', tr: 'okumak', nl: 'lezen', sv: 'läsa', pl: 'czytać' },
                'write': { es: 'escribir', fr: 'écrire', de: 'schreiben', it: 'scrivere', pt: 'escrever', zh: '写', ja: '書く', ko: '쓰다', ar: 'يكتب', ru: 'писать', hi: 'लिखना', tr: 'yazmak', nl: 'schrijven', sv: 'skriva', pl: 'pisać' },
                'help': { es: 'ayuda', fr: 'aide', de: 'hilfe', it: 'aiuto', pt: 'ajuda', zh: '帮助', ja: '助けて', ko: '도움', ar: 'مساعدة', ru: 'помощь', hi: 'मदद', tr: 'yardım', nl: 'hulp', sv: 'hjälp', pl: 'pomoc' },
                'beautiful': { es: 'hermoso', fr: 'beau', de: 'schön', it: 'bello', pt: 'bonito', zh: '美丽', ja: '美しい', ko: '아름다운', ar: 'جميل', ru: 'красивый', hi: 'सुंदर', tr: 'güzel', nl: 'mooi', sv: 'vacker', pl: 'piękny' },
                'good': { es: 'bueno', fr: 'bon', de: 'gut', it: 'buono', pt: 'bom', zh: '好', ja: '良い', ko: '좋은', ar: 'جيد', ru: 'хороший', hi: 'अच्छा', tr: 'iyi', nl: 'goed', sv: 'bra', pl: 'dobry' },
                'bad': { es: 'malo', fr: 'mauvais', de: 'schlecht', it: 'cattivo', pt: 'ruim', zh: '坏', ja: '悪い', ko: '나쁜', ar: 'سيئ', ru: 'плохой', hi: 'बुरा', tr: 'kötü', nl: 'slecht', sv: 'dålig', pl: 'zły' }
            };
            
            const lowerText = text.toLowerCase().trim();
            
            // Check for exact match
            if (translations[lowerText] && translations[lowerText][toLang]) {
                return translations[lowerText][toLang];
            }
            
            // Check for partial matches (for phrases)
            for (const [key, value] of Object.entries(translations)) {
                if (lowerText.includes(key) && value[toLang]) {
                    return value[toLang];
                }
            }
            
            // If no match found, return formatted text
            const langName = gameState.unlockedLanguages.find(l => l.code === toLang)?.name || toLang;
            return `${text} (in ${langName})`;
        }

        async function showResults(original, translated, toLang, xp) {
            const resultSection = document.getElementById('result-section');
            const definition = document.getElementById('definition');
            const quote = document.getElementById('quote');
            const xpGained = document.getElementById('xp-gained');
            
            // Get real definition from Free Dictionary API
            const firstWord = original.trim().split(/\s+/)[0].toLowerCase();
            let definitionText = 'A word that bridges cultures and connects people.';
            
            try {
                const dictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${firstWord}`);
                if (dictResponse.ok) {
                    const dictData = await dictResponse.json();
                    if (dictData[0] && dictData[0].meanings && dictData[0].meanings[0]) {
                        const meaning = dictData[0].meanings[0];
                        if (meaning.definitions && meaning.definitions[0]) {
                            definitionText = meaning.definitions[0].definition;
                        }
                    }
                }
            } catch (error) {
                console.log('Definition not found, using default');
            }
            
            // Show definition (without sentence)
            definition.textContent = `Definition: ${definitionText}`;
            
            // Generate witty quote
            quote.textContent = `"${generateWittyQuote(original, translated)}"`;
            
            // Show XP
            xpGained.textContent = `+${xp} XP Earned!`;
            
            resultSection.classList.add('active');
            
            // Store current translation for speech
            window.currentTranslation = { text: translated, lang: toLang };
        }

        function generateWittyQuote(original, translated) {
            const quotes = [
                `I tried to say "${original}" in another language, but my tongue did a 360° spin and now I speak fluent "${translated}"!`,
                `Why did "${original}" cross the language barrier? To become "${translated}" on the other side!`,
                `"${original}" walked into a multilingual bar and came out as "${translated}". The bartender said, "That's the spirit!"`,
                `They say "${original}" is universal, but "${translated}" is universally cooler with 43% more vowels!`,
                `If "${original}" and "${translated}" had a rap battle, the dictionary would surrender.`,
                `Breaking: Local word "${original}" discovers it has an alter ego named "${translated}". Identity crisis ensues.`,
                `"${original}" isn't just a word, it's a lifestyle. "${translated}" is that lifestyle in pajamas.`,
                `Scientists confirm: saying "${translated}" instead of "${original}" makes you 78% more internationally sophisticated!`
            ];
            return quotes[Math.floor(Math.random() * quotes.length)];
        }

        function speakTranslation() {
            if (!window.currentTranslation) {
                alert('Please translate text first!');
                return;
            }
            
            const { text, lang } = window.currentTranslation;
            
            if ('speechSynthesis' in window) {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = lang;
                
                // Get available voices
                const voices = window.speechSynthesis.getVoices();
                const voice = voices.find(v => v.lang.startsWith(lang));
                
                if (voice) {
                    utterance.voice = voice;
                }
                
                utterance.onerror = (event) => {
                    if (event.error === 'language-unavailable' || !voice) {
                        const langName = gameState.unlockedLanguages.find(l => l.code === lang)?.name || 'this language';
                        alert(`Voice not available for ${langName}, but the translation is correct! You can copy the text: "${text}"`);
                    } else {
                        alert('Speech synthesis error. Your translation is correct, but audio playback is unavailable.');
                    }
                };
                
                try {
                    window.speechSynthesis.speak(utterance);
                } catch (error) {
                    const langName = gameState.unlockedLanguages.find(l => l.code === lang)?.name || 'this language';
                    alert(`Voice not available for ${langName}, but the translation is correct! "${text}"`);
                }
            } else {
                alert('Text-to-speech not supported in your browser. Your translation is: "' + text + '"');
            }
        }

        // Load voices when available
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => {
                window.speechSynthesis.getVoices();
            };
        }
        
        let currentTranslation = '';
        window.currentTranslation = null;

        // Settings
        function openSettings() {
            document.getElementById('settings-modal').classList.add('active');
            document.getElementById('settings-username').value = gameState.profile.name;
            populateAvatarGrid('settings-avatar-grid', true);
            
            // Pre-select current avatar
            setTimeout(() => {
                const avatars = document.querySelectorAll('#settings-avatar-grid .avatar-option');
                avatars.forEach(av => {
                    if (av.textContent === gameState.profile.avatar) {
                        av.classList.add('selected');
                    }
                });
            }, 100);
        }

        function closeSettings() {
            document.getElementById('settings-modal').classList.remove('active');
        }

        function updateProfile() {
            const newName = document.getElementById('settings-username').value.trim();
            if (newName) {
                gameState.profile.name = newName;
            }
            if (selectedAvatar) {
                gameState.profile.avatar = selectedAvatar;
            }
            saveGameState();
            updateUI();
            closeSettings();
        }

        // Initialize on load
        window.addEventListener('load', () => {
            loadGameState();
        });

