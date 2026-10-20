
        const starsContainer = document.getElementById('stars');
        for (let i = 0; i < 100; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            starsContainer.appendChild(star);
        }
        
        let ravanHealth = 100;
        let arrowsShot = 0;
        const maxArrows = 5;
        const damagePerArrow = 20;
        
        const shootBtn = document.getElementById('shootBtn');
        const arrow = document.getElementById('arrow');
        const ravan = document.getElementById('ravan');
        const victoryMsg = document.getElementById('victoryMsg');
        const particlesContainer = document.getElementById('particles');
        const fireworksContainer = document.getElementById('fireworks');
        const healthBar = document.getElementById('healthBar');
        const healthText = document.getElementById('healthText');
        
        // Audio elements
        const audioPlayer = document.getElementById('audioPlayer');
        const playBtn = document.getElementById('playBtn');
        const progressBar = document.getElementById('progressBar');
        const progressContainer = document.getElementById('progressContainer');
        const timeDisplay = document.getElementById('timeDisplay');
        const scrubber = document.getElementById('scrubber');

        // New character status elements
        const ravanHealthIndicator = document.getElementById('ravanHealthIndicator');
        const ravanHealthCircle = document.getElementById('ravanHealthCircle');
        const ravanHealthText = document.getElementById('ravanHealthText');
        const ramArrowCounter = document.getElementById('ramArrowCounter');
        
        let isAnimating = false;
        
        function updateHealthBar() {
            const healthPercent = (ravanHealth / 100) * 100;
            healthBar.style.width = healthPercent + '%';
            healthText.textContent = ravanHealth + ' HP';

            // Update circular health indicator
            const healthAngle = (ravanHealth / 100) * 360; // Convert to degrees for conic-gradient
            ravanHealthCircle.style.setProperty('--health-angle', healthAngle + 'deg');
            ravanHealthText.textContent = ravanHealth + '%';

            if (ravanHealth <= 20) {
                healthBar.style.background = 'linear-gradient(90deg, #darkred, #8b0000)';
            } else if (ravanHealth <= 50) {
                healthBar.style.background = 'linear-gradient(90deg, #ff4444, #ff0000)';
            }

            // Update Ram's arrow counter (showing remaining arrows)
            ramArrowCounter.textContent = `${maxArrows - arrowsShot}/${maxArrows}`;
        }
        
        function shootArrow() {
            if (isAnimating || arrowsShot >= maxArrows) return;
            isAnimating = true;
            shootBtn.disabled = true;
            arrowsShot++;
            arrow.style.left = '5%';
            arrow.style.top = '38%';
            arrow.classList.remove('shooting');
            void arrow.offsetWidth;
            arrow.classList.add('shooting');
            setTimeout(() => {
                ravanHealth = Math.max(0, ravanHealth - damagePerArrow);
                updateHealthBar();
                ravan.classList.add('hit');
                setTimeout(() => ravan.classList.remove('hit'), 300);
                createSmallExplosion(68, 38);
                if (ravanHealth <= 0) {
                    setTimeout(() => {
                        defeatRavan();
                    }, 500);
                } else {
                    setTimeout(() => {
                        isAnimating = false;
                        if (arrowsShot < maxArrows) {
                            shootBtn.disabled = false;
                            shootBtn.textContent = `Shoot Arrow! 🏹 (${maxArrows - arrowsShot} left)`;
                        }
                    }, 800);
                }
                setTimeout(() => {
                    arrow.classList.remove('shooting');
                }, 100);
            }, 800);
        }
        
        function createSmallExplosion(leftPercent, topPercent) {
            for (let i = 0; i < 15; i++) {
                const particle = document.createElement('div');
                particle.className = 'fire-particle active';
                const angle = (i / 15) * Math.PI * 2;
                const distance = 30 + Math.random() * 40;
                particle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
                particle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
                particle.style.left = leftPercent + '%';
                particle.style.top = topPercent + '%';
                particlesContainer.appendChild(particle);
                setTimeout(() => particle.remove(), 1000);
            }
        }
        
        function defeatRavan() {
            for (let i = 0; i < 40; i++) {
                const particle = document.createElement('div');
                particle.className = 'fire-particle active';
                const angle = (i / 40) * Math.PI * 2;
                const distance = 80 + Math.random() * 120;
                particle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
                particle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
                particle.style.left = '68%';
                particle.style.top = '38%';
                particlesContainer.appendChild(particle);
                setTimeout(() => particle.remove(), 1000);
            }
            ravan.classList.add('defeated');
            setTimeout(() => {
                victoryMsg.classList.add('show');
                shootBtn.textContent = 'Play Again! 🔄';
                shootBtn.disabled = false;
                isAnimating = false;
                for (let i = 0; i < 60; i++) {
                    setTimeout(() => {
                        createFirework();
                    }, i * 100);
                }
            }, 1000);
        }
        
        function createFirework() {
            const colors = ['#ffd700', '#ff6b00', '#ff0000', '#00ff00', '#0066ff', '#ff00ff'];
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight * 0.6;
            for (let i = 0; i < 25; i++) {
                const firework = document.createElement('div');
                firework.className = 'firework burst';
                firework.style.background = colors[Math.floor(Math.random() * colors.length)];
                const angle = (i / 25) * Math.PI * 2;
                const distance = 60 + Math.random() * 120;
                firework.style.setProperty('--fx', Math.cos(angle) * distance + 'px');
                firework.style.setProperty('--fy', Math.sin(angle) * distance + 'px');
                firework.style.left = x + 'px';
                firework.style.top = y + 'px';
                fireworksContainer.appendChild(firework);
                setTimeout(() => {
                    firework.remove();
                }, 1000);
            }
        }
        
        function resetGame() {
            ravanHealth = 100;
            arrowsShot = 0;
            isAnimating = false;
            updateHealthBar();
            victoryMsg.classList.remove('show');
            ravan.classList.remove('defeated');
            shootBtn.textContent = 'Shoot Arrow! 🏹';
            shootBtn.disabled = false;
            particlesContainer.innerHTML = '';
            fireworksContainer.innerHTML = '';
        }
        
        // Audio Controls
        function updatePlayButton() {
            if (audioPlayer.paused) {
                playBtn.textContent = '▶';
            } else {
                playBtn.textContent = '⏸';
            }
        }
        
        function updateProgress() {
            const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            progressBar.style.width = `${percent}%`;
            scrubber.style.left = `${percent}%`; // Position the scrubber

            // Format time display
            const currentMinutes = Math.floor(audioPlayer.currentTime / 60);
            const currentSeconds = Math.floor(audioPlayer.currentTime % 60);
            const durationMinutes = Math.floor(audioPlayer.duration / 60) || 0;
            const durationSeconds = Math.floor(audioPlayer.duration % 60) || 0;

            timeDisplay.textContent = `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')} / ${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
        }
        
        playBtn.addEventListener('click', () => {
            if (audioPlayer.paused) {
                audioPlayer.play();
            } else {
                audioPlayer.pause();
            }
            updatePlayButton();
        });
        
        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('ended', () => {
            updatePlayButton();
        });
        
        function seekAudio(e) {
            const rect = progressContainer.getBoundingClientRect();
            const width = progressContainer.clientWidth;
            let clickX;

            // Handle both mouse and touch events
            if (e.type === 'touchend' || e.type === 'touchstart') {
                e.preventDefault(); // Prevent scrolling on touch
                const touch = e.changedTouches ? e.changedTouches[0] : e.touches[0];
                clickX = touch.clientX - rect.left;
            } else {
                clickX = e.offsetX;
            }

            // Ensure clickX is within bounds
            clickX = Math.max(0, Math.min(clickX, width));

            const duration = audioPlayer.duration;
            if (duration && !isNaN(duration)) {
                audioPlayer.currentTime = (clickX / width) * duration;
            }
        }

        // Add both click and touch event listeners for better mobile support
        progressContainer.addEventListener('click', seekAudio);
        progressContainer.addEventListener('touchend', seekAudio);

        // Add scrubber drag functionality
        let isDragging = false;

        function startDrag(e) {
            isDragging = true;
            document.body.style.userSelect = 'none'; // Prevent text selection during drag
            seekAudio(e); // Update position immediately
        }

        function drag(e) {
            if (!isDragging) return;
            seekAudio(e);
        }

        function stopDrag() {
            isDragging = false;
            document.body.style.userSelect = ''; // Restore text selection
        }

        // Mouse events for scrubber
        scrubber.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);

        // Touch events for scrubber
        scrubber.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrag(e);
        });
        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
                drag(e);
            }
        });
        document.addEventListener('touchend', stopDrag);
        
        shootBtn.addEventListener('click', () => {
            if (ravanHealth <= 0 || arrowsShot >= maxArrows) {
                resetGame();
            } else {
                shootArrow();
            }
        });

        updateHealthBar();
 