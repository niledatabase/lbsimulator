// File: src/main.js
import * as THREE from 'three';

class Request {
    constructor(id, cpuLoad, memoryLoad, processingTime) {
        this.id = id;
        this.cpuLoad = cpuLoad;        // 0-100%
        this.memoryLoad = memoryLoad;   // 0-100%
        this.processingTime = processingTime;  // milliseconds
        this.startTime = Date.now();
        this.mesh = null;
    }

    isComplete() {
        return (Date.now() - this.startTime) >= this.processingTime;
    }

    getProgress() {
        return Math.min(1, (Date.now() - this.startTime) / this.processingTime);
    }
}

class Server {
    constructor(position) {
        this.position = position;
        this.requests = [];
        this.maxCpu = 100;
        this.maxMemory = 100;
        this.mesh = null;
        this.cpuBar = null;
        this.memoryBar = null;
        this.statsElement = null;  // New HTML element for stats
        this.rejectedRequests = 0;  // Track rejections per server
        this.completedRequests = 0;
        this.totalResponseTime = 0;
    }

    getAverageResponseTime() {
        if (this.completedRequests === 0) return 0;
        return this.totalResponseTime / this.completedRequests;
    }

    getCurrentLoad() {
        const totalCpu = this.requests.reduce((sum, req) => sum + req.cpuLoad, 0);
        const totalMemory = this.requests.reduce((sum, req) => sum + req.memoryLoad, 0);
        return { cpu: totalCpu, memory: totalMemory };
    }

    canHandleRequest(request) {
        const currentLoad = this.getCurrentLoad();
        return (currentLoad.cpu + request.cpuLoad <= this.maxCpu) && 
               (currentLoad.memory + request.memoryLoad <= this.maxMemory);
    }

    addRequest(request) {
        this.requests.push(request);
    }

    updateRequests() {
        const completedNow = this.requests.filter(req => req.isComplete());
        // Update stats for completed requests
        completedNow.forEach(req => {
            this.completedRequests++;
            this.totalResponseTime += req.processingTime;
        });
        // Remove completed requests
        this.requests = this.requests.filter(req => !req.isComplete());
    }
}

class LoadBalancerAlgorithm {
    selectServer(servers, currentIndex) {
        throw new Error('Method not implemented');
    }
}

class RoundRobinAlgorithm extends LoadBalancerAlgorithm {
    selectServer(servers, currentIndex) {
        for (let i = 0; i < servers.length; i++) {
            const serverIndex = (currentIndex + i) % servers.length;
            if (servers[serverIndex].canHandleRequest) {
                return serverIndex;
            }
        }
        return currentIndex;  // Return current if none can handle
    }
}

class RandomAlgorithm extends LoadBalancerAlgorithm {
    selectServer(servers, currentIndex) {
        // Try up to servers.length times to find an available server
        const tried = new Set();
        while (tried.size < servers.length) {
            const index = Math.floor(Math.random() * servers.length);
            if (servers[index].canHandleRequest) {
                return index;
            }
            tried.add(index);
        }
        return Math.floor(Math.random() * servers.length);  // Return random if none can handle
    }
}

class LeastRequestsAlgorithm extends LoadBalancerAlgorithm {
    selectServer(servers, currentIndex) {
        let minRequests = Infinity;
        let selectedIndex = 0;

        // Find the server with the least number of active requests
        servers.forEach((server, index) => {
            if (server.requests.length < minRequests) {
                minRequests = server.requests.length;
                selectedIndex = index;
            }
        });

        return selectedIndex;
    }
}

class LeastResponseTimeAlgorithm extends LoadBalancerAlgorithm {
    selectServer(servers, currentIndex) {
        let minResponseTime = Infinity;
        let selectedIndex = 0;

        // Find the server with the lowest average response time
        servers.forEach((server, index) => {
            const avgResponseTime = server.getAverageResponseTime();
            // If server has no history, use its current request count as a tiebreaker
            const effectiveTime = avgResponseTime === 0 ? 
                server.requests.length * 100 : // Penalize servers with no history
                avgResponseTime;
            
            if (effectiveTime < minResponseTime) {
                minResponseTime = effectiveTime;
                selectedIndex = index;
            }
        });

        return selectedIndex;
    }
}

class DynamicAlgorithm extends LoadBalancerAlgorithm {
    selectServer(servers, currentIndex) {
        let minCpuLoad = Infinity;
        let selectedIndex = 0;

        // Find the server with the least CPU utilization
        servers.forEach((server, index) => {
            const currentLoad = server.getCurrentLoad();
            if (currentLoad.cpu < minCpuLoad) {
                minCpuLoad = currentLoad.cpu;
                selectedIndex = index;
            }
        });

        return selectedIndex;
    }
}

class LoadBalancerSimulation {
    constructor(containerId, algorithm) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.algorithm = algorithm;
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // Camera setup - Adjusted to show top half
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.OrthographicCamera(
            -45, 45,  // Increased from -37.5, 37.5 (20% wider)
            15, -25,
            0.1, 1000
        );
        this.camera.position.set(0, -5, 30);  // Moved camera down
        this.camera.lookAt(0, -5, 0);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);
        
        // Simulation properties
        this.numServers = 4;
        this.servers = [];
        this.currentServerIndex = 0;
        this.loadBalancerMesh = null;
        this.activeRequests = [];
        this.requestCount = 0;
        
        // Define request types
        this.requestTypes = [
            { cpu: 5, memory: 3, color: '#4CAF50' },  // Green - Low CPU, Low Memory
            { cpu: 8, memory: 4, color: '#2196F3' },  // Blue - Medium CPU, Low Memory
            { cpu: 4, memory: 8, color: '#FF9800' },  // Orange - Low CPU, Medium Memory
            { cpu: 10, memory: 6, color: '#F44336' }  // Red - High CPU, Medium Memory
        ];

        this.createLegend();
        
        // Add data points array for graphs
        this.cpuBalanceHistory = [];
        this.memoryBalanceHistory = [];
        this.maxDataPoints = 50; // Store last 50 readings
        
        this.totalRejectedRequests = 0;  // Track total rejections
        
        this.initialZoom = {
            left: -37.5,    // Increased from -25
            right: 37.5,    // Increased from 25
            top: 15,
            bottom: -25
        };
        
        this.setupScene();
        this.animate();

        // Create rejection counter display
        this.rejectionCounter = document.createElement('div');
        this.rejectionCounter.style.position = 'absolute';
        this.rejectionCounter.style.top = '40px';  // Position below the title
        this.rejectionCounter.style.left = '10px';
        this.rejectionCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        this.rejectionCounter.style.color = '#FF6B6B';
        this.rejectionCounter.style.padding = '6px 10px';  // Slightly smaller padding
        this.rejectionCounter.style.borderRadius = '4px';
        this.rejectionCounter.style.fontFamily = 'Arial, sans-serif';
        this.rejectionCounter.style.fontSize = '11px';  // Smaller font
        this.rejectionCounter.style.display = 'flex';
        this.rejectionCounter.style.alignItems = 'center';
        this.rejectionCounter.style.zIndex = '1000';
        this.rejectionCounter.style.width = 'fit-content';  // Adjust width to content
        
        // Add warning icon
        const warningIcon = document.createElement('div');
        warningIcon.innerHTML = '⚠️';
        warningIcon.style.marginRight = '4px';  // Smaller margin
        warningIcon.style.fontSize = '12px';  // Smaller icon
        this.rejectionCounter.appendChild(warningIcon);
        
        // Add counter text
        const counterText = document.createElement('div');
        counterText.textContent = 'Rejected: 0';
        this.rejectionCounter.appendChild(counterText);
        
        this.container.appendChild(this.rejectionCounter);
    }

    setupScene() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Add directional lights for better shadows and highlights
        const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight1.position.set(5, 5, 5);
        this.scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        dirLight2.position.set(-5, 5, -5);
        this.scene.add(dirLight2);

        // Add point lights for LED glow effects
        const pointLight = new THREE.PointLight(0x4CAF50, 0.5, 10);
        pointLight.position.set(0, 12, 2);
        this.scene.add(pointLight);

        this.createLoadBalancer();
        this.initializeServers();
    }

    createLoadBalancer() {
        this.loadBalancerMesh = new THREE.Group();

        // Create main body shape - made wider and taller
        const shape = new THREE.Shape();
        shape.moveTo(-3, -1);
        shape.lineTo(3, -1);
        shape.lineTo(3, 1);
        shape.lineTo(-3, 1);
        shape.lineTo(-3, -1);

        // Enhanced extrude settings
        const extrudeSettings = {
            steps: 2,
            depth: 1.5,
            bevelEnabled: true,
            bevelThickness: 0.2,
            bevelSize: 0.2,
            bevelSegments: 5
        };

        // Create main body with enhanced materials
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshPhysicalMaterial({
            color: 0x2196F3,
            metalness: 0.9,
            roughness: 0.3,
            clearcoat: 0.5,
            clearcoatRoughness: 0.2,
            reflectivity: 0.8
        });
        const body = new THREE.Mesh(geometry, material);
        this.loadBalancerMesh.add(body);

        // Add more detailed ventilation pattern
        const ventPattern = new THREE.Group();
        const ventHoleGeo = new THREE.CircleGeometry(0.08, 8);
        const ventHoleMat = new THREE.MeshPhysicalMaterial({
            color: 0x000000,
            metalness: 0.9,
            roughness: 0.1
        });

        for(let x = -2.5; x <= 2.5; x += 0.3) {
            for(let y = -0.7; y <= 0.7; y += 0.3) {
                const vent = new THREE.Mesh(ventHoleGeo, ventHoleMat);
                vent.position.set(x, y, 0.8);
                ventPattern.add(vent);
            }
        }
        this.loadBalancerMesh.add(ventPattern);

        // Add larger network ports
        const portGroup = new THREE.Group();
        const portGeo = new THREE.BoxGeometry(0.3, 0.4, 0.2);
        const portMat = new THREE.MeshPhysicalMaterial({
            color: 0x303030,
            metalness: 0.9,
            roughness: 0.2
        });

        for(let i = 0; i < 4; i++) {
            const port = new THREE.Mesh(portGeo, portMat);
            port.position.set(-2.2 + i * 0.6, -1.1, 0.7);
            portGroup.add(port);
        }
        this.loadBalancerMesh.add(portGroup);

        // Add larger status display
        const displayGeo = new THREE.PlaneGeometry(2, 0.6);
        const displayMat = new THREE.MeshPhysicalMaterial({
            color: 0x000000,
            metalness: 0.0,
            roughness: 0.1,
            transmission: 0.5,
            thickness: 0.2,
            opacity: 0.7,
            transparent: true
        });
        const display = new THREE.Mesh(displayGeo, displayMat);
        display.position.set(1.5, 0, 0.8);
        this.loadBalancerMesh.add(display);

        // Add larger status LEDs
        const ledGroup = new THREE.Group();
        const ledGeo = new THREE.CircleGeometry(0.1, 16);
        const ledMats = [
            new THREE.MeshBasicMaterial({ 
                color: 0x4CAF50,
                emissive: 0x4CAF50,
                emissiveIntensity: 0.5
            }),
            new THREE.MeshBasicMaterial({ 
                color: 0xFFC107,
                emissive: 0xFFC107,
                emissiveIntensity: 0.5
            }),
            new THREE.MeshBasicMaterial({ 
                color: 0x2196F3,
                emissive: 0x2196F3,
                emissiveIntensity: 0.5
            })
        ];

        for(let i = 0; i < 3; i++) {
            const led = new THREE.Mesh(ledGeo, ledMats[i]);
            led.position.set(2.2, 0.5 - i * 0.3, 0.8);
            ledGroup.add(led);
        }
        this.loadBalancerMesh.add(ledGroup);

        this.loadBalancerMesh.position.set(0, -5, 0);  // Moved load balancer up in screen
        this.scene.add(this.loadBalancerMesh);
    }

    initializeServers() {
        // Remove old servers
        this.servers.forEach(server => {
            if (server.mesh) this.scene.remove(server.mesh);
            if (server.cpuBar) this.scene.remove(server.cpuBar);
            if (server.memoryBar) this.scene.remove(server.memoryBar);
            if (server.statsElement) this.container.removeChild(server.statsElement);
        });
        this.servers = [];

        // Calculate available space and required spacing
        const viewWidth = 35;
        const serverWidth = 4;  // Adjusted width
        const minSpacing = 5;   // More spacing between servers
        
        // Calculate the spacing needed
        const totalSpacingNeeded = (this.numServers - 1) * minSpacing;
        const totalServerWidth = this.numServers * serverWidth;
        const totalWidth = totalSpacingNeeded + totalServerWidth;
        
        // Calculate scale factor to fit everything in view
        const scale = Math.min(1, viewWidth / totalWidth);
        
        // Calculate final dimensions
        const scaledServerWidth = serverWidth * scale;
        const scaledSpacing = minSpacing * scale;
        const totalScaledWidth = (scaledServerWidth * this.numServers) + (scaledSpacing * (this.numServers - 1));
        const startX = -totalScaledWidth / 2 + scaledServerWidth / 2;

        // Create servers with proper spacing
        for (let i = 0; i < this.numServers; i++) {
            const position = new THREE.Vector3(
                startX + i * (scaledServerWidth + scaledSpacing),
                -15,  // Moved servers up in screen
                0
            );
            const server = this.createServer(position, scale * 1.5);
            this.servers.push(server);
        }
    }

    createServer(position, scale = 1) {
        const server = new Server(position);
        server.mesh = new THREE.Group();

        // Create main server body - modern dark theme
        const bodyGeo = new THREE.PlaneGeometry(4 * scale, 5 * scale);
        const bodyMat = new THREE.MeshBasicMaterial({
            color: 0x1A1A2E  // Dark blue-gray background
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        server.mesh.add(body);

        // Add border with gradient effect
        const borderGeo = new THREE.PlaneGeometry(4.02 * scale, 5.02 * scale);
        const borderMat = new THREE.MeshBasicMaterial({
            color: 0x7B68EE  // Medium slate blue - more vibrant
        });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.z = -0.01;
        server.mesh.add(border);

        // Add horizontal lines with dots
        const lineGeo = new THREE.PlaneGeometry(3 * scale, 0.08 * scale);
        const dotGeo = new THREE.CircleGeometry(0.04 * scale, 32);
        const lineMat = new THREE.MeshBasicMaterial({
            color: 0xFF6B6B  // Coral red - more vibrant
        });

        // Position lines and dots evenly
        const positions = [-1.5, -0.5, 0.5, 1.5];
        positions.forEach(y => {
            // Add line
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.position.set(0.2 * scale, y * scale, 0.01);
            server.mesh.add(line);

            // Add dot
            const dot = new THREE.Mesh(dotGeo, lineMat);
            dot.position.set(-1.7 * scale, y * scale, 0.01);
            server.mesh.add(dot);
        });

        // Position the server
        server.mesh.position.copy(position);
        this.scene.add(server.mesh);

        // Create usage bars with modern colors
        const barGeometry = new THREE.PlaneGeometry(3.6 * scale, 0.2 * scale);
        
        // CPU bar - matching the border color
        const cpuBarMat = new THREE.MeshBasicMaterial({
            color: 0x7B68EE,
            transparent: true,
            opacity: 0.9
        });
        server.cpuBar = new THREE.Mesh(barGeometry, cpuBarMat);
        server.cpuBar.position.set(position.x, position.y + 3 * scale, position.z + 0.02);
        server.cpuBar.scale.x = 0;
        this.scene.add(server.cpuBar);

        // Memory bar - matching the line color
        const memBarMat = new THREE.MeshBasicMaterial({
            color: 0xFF6B6B,
            transparent: true,
            opacity: 0.9
        });
        server.memoryBar = new THREE.Mesh(barGeometry, memBarMat);
        server.memoryBar.position.set(position.x, position.y + 2.4 * scale, position.z + 0.02);
        server.memoryBar.scale.x = 0;
        this.scene.add(server.memoryBar);

        // Create stats element with matching theme and scaled font size
        const statsElement = document.createElement('div');
        statsElement.style.position = 'absolute';
        statsElement.style.textAlign = 'center';
        statsElement.style.color = '#FFFFFF';
        statsElement.style.fontFamily = 'Arial, sans-serif';
        statsElement.style.fontSize = `${Math.max(6, 8 * scale)}px`;  // Reduced base size from 12 to 8, min from 8 to 6
        statsElement.style.fontWeight = 'normal';
        statsElement.style.zIndex = '1000';
        statsElement.style.lineHeight = '1.1';  // Reduced line height from 1.2 to 1.1
        statsElement.innerHTML = `
            <div style="margin-bottom: ${1 * scale}px">CPU: 0%</div>
            <div>MEM: 0%</div>
        `;
        this.container.appendChild(statsElement);
        server.statsElement = statsElement;

        return server;
    }

    createLegend() {
        const requestTypesContainer = document.getElementById('requestTypes');
        
        this.requestTypes.forEach(type => {
            const item = document.createElement('div');
            item.className = 'request-type';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = type.color;
            
            const text = document.createElement('div');
            text.textContent = `${type.cpu}% / ${type.memory}%`;
            
            item.appendChild(colorBox);
            item.appendChild(text);
            requestTypesContainer.appendChild(item);
        });
    }

    createRequest() {
        // Select a random request type
        const requestType = this.requestTypes[Math.floor(Math.random() * this.requestTypes.length)];

        const request = new Request(
            this.requestCount++,
            requestType.cpu,
            requestType.memory,
            Math.random() * 499 + 1  // Random duration between 1-500ms
        );

        // Create request visualization
        const geometry = new THREE.CircleGeometry(0.5, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(requestType.color)
        });
        request.mesh = new THREE.Mesh(geometry, material);
        request.mesh.position.copy(this.loadBalancerMesh.position);
        this.scene.add(request.mesh);

        // Use the algorithm to select a server
        let assigned = false;
        const serverIndex = this.algorithm.selectServer(this.servers, this.currentServerIndex);
        const server = this.servers[serverIndex];
        
        if (server.canHandleRequest(request)) {
            this.currentServerIndex = (serverIndex + 1) % this.numServers;
            this.animateRequest(request, server);
            server.addRequest(request);
            assigned = true;
        }

        // If no server can handle the request, reject it
        if (!assigned) {
            this.totalRejectedRequests++;
            this.servers[serverIndex].rejectedRequests++;
            this.rejectionCounter.lastChild.textContent = `Rejected: ${this.totalRejectedRequests}`;
            
            // Animate the request fading out with red pulse
            const startTime = Date.now();
            const duration = 500;
            
            // Create pulse effect
            const pulseGeometry = new THREE.CircleGeometry(0.7, 32);
            const pulseMaterial = new THREE.MeshBasicMaterial({
                color: 0xFF6B6B,
                transparent: true,
                opacity: 0.5
            });
            const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
            pulse.position.copy(request.mesh.position);
            this.scene.add(pulse);
            
            const fadeOut = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Fade out request
                material.opacity = 1 - progress;
                material.transparent = true;
                
                // Pulse effect
                pulse.scale.set(1 + progress, 1 + progress, 1);
                pulseMaterial.opacity = 0.5 * (1 - progress);
                
                if (progress < 1) {
                    requestAnimationFrame(fadeOut);
                } else {
                    this.scene.remove(request.mesh);
                    this.scene.remove(pulse);
                }
            };
            
            fadeOut();
        }
    }

    animateRequest(request, server) {
        const startPos = this.loadBalancerMesh.position.clone();
        const endPos = server.mesh.position.clone();
        const startTime = Date.now();
        const duration = 1000; // 1 second animation

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Curved path animation
            const currentPos = new THREE.Vector3();
            currentPos.y = startPos.y + (endPos.y - startPos.y) * progress;
            currentPos.x = startPos.x + (endPos.x - startPos.x) * progress;
            // Add a slight horizontal curve based on vertical progress
            const curve = Math.sin(progress * Math.PI) * (endPos.x - startPos.x) * 0.2;
            currentPos.x += curve;
            
            request.mesh.position.copy(currentPos);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Remove the request mesh when it reaches the server
                this.scene.remove(request.mesh);
            }
        };

        animate();
    }

    updateServerVisuals() {
        const loads = this.servers.map(server => server.getCurrentLoad());
        
        // Calculate statistics
        const cpuLoads = loads.map(load => load.cpu);
        const memoryLoads = loads.map(load => load.memory);
        
        const cpuStats = this.calculateStats(cpuLoads);
        const memoryStats = this.calculateStats(memoryLoads);

        // Update stats display
        this.updateStatsDisplay(cpuStats, memoryStats);

        this.servers.forEach((server, index) => {
            const load = loads[index];
            
            // Update CPU and Memory bars
            server.cpuBar.scale.x = load.cpu / server.maxCpu;
            server.cpuBar.position.x = server.mesh.position.x - (1.4 * (1 - server.cpuBar.scale.x));

            server.memoryBar.scale.x = load.memory / server.maxMemory;
            server.memoryBar.position.x = server.mesh.position.x - (1.4 * (1 - server.memoryBar.scale.x));

            // Update server requests
            server.updateRequests();

            // Update HTML stats position - positioned below server
            const vector = new THREE.Vector3(
                server.mesh.position.x,
                server.mesh.position.y - 4.5,
                server.mesh.position.z
            );
            vector.project(this.camera);
            
            const x = (vector.x * 0.5 + 0.5) * this.container.clientWidth;
            const y = (-vector.y * 0.5 + 0.5) * this.container.clientHeight;
            
            server.statsElement.style.transform = `translate(-50%, 0)`;
            server.statsElement.style.left = `${x}px`;
            server.statsElement.style.top = `${y}px`;
            server.statsElement.innerHTML = `
                <div style="margin-bottom: 1px">CPU: ${Math.round(load.cpu)}%</div>
                <div style="margin-bottom: 1px">MEM: ${Math.round(load.memory)}%</div>
                <div style="margin-bottom: 1px">Requests: ${server.requests.length}</div>
                <div>Avg Latency: ${Math.round(server.getAverageResponseTime())}ms</div>
            `;
        });
    }

    calculateStats(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        return {
            mean: Math.round(mean * 10) / 10,
            variance: Math.round(variance * 10) / 10,
            stdDev: Math.round(stdDev * 10) / 10,
            min: Math.round(min * 10) / 10,
            max: Math.round(max * 10) / 10
        };
    }

    calculateBalanceScore(values) {
        if (values.length === 0) return 100;  // No servers = perfectly balanced
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        if (mean === 0) return 100;  // All zeros = perfectly balanced
        
        // Calculate how far each value deviates from the mean
        const maxDeviation = Math.max(...values.map(v => Math.abs(v - mean)));
        
        // Convert to a 0-100 score where:
        // 0 deviation = 100% balanced
        // deviation equal to mean = 0% balanced
        const score = Math.max(0, 100 * (1 - maxDeviation / (mean * 2)));
        
        return Math.round(score);
    }

    updateStatsDisplay(cpuStats, memoryStats) {
        if (!this.statsElement) {
            this.statsElement = document.createElement('div');
            this.statsElement.style.position = 'absolute';
            this.statsElement.style.bottom = '10px';
            this.statsElement.style.left = '10px';  // Changed from 50% to 10px
            this.statsElement.style.transform = 'none';  // Removed translateX
            this.statsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
            this.statsElement.style.color = 'white';
            this.statsElement.style.padding = '10px';
            this.statsElement.style.borderRadius = '6px';
            this.statsElement.style.fontFamily = 'Arial, sans-serif';
            this.statsElement.style.fontSize = '12px';
            this.statsElement.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
            this.statsElement.style.width = '220px';
            this.statsElement.style.zIndex = '1000';
            
            // Create canvas for graphs
            this.graphCanvas = document.createElement('canvas');
            this.graphCanvas.width = 220;
            this.graphCanvas.height = 80;
            this.graphCanvas.style.marginTop = '8px';
            
            this.statsElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 11px; opacity: 0.9;">Balance History</div>
                    <div style="display: flex; gap: 12px; font-size: 11px;">
                        <div style="display: flex; align-items: center;">
                            <div style="width: 6px; height: 6px; background: #4CAF50; margin-right: 4px; border-radius: 50%;"></div>
                            <span id="cpuValue-${this.containerId}">0</span>%
                        </div>
                        <div style="display: flex; align-items: center;">
                            <div style="width: 6px; height: 6px; background: #FF6B6B; margin-right: 4px; border-radius: 50%;"></div>
                            <span id="memValue-${this.containerId}">0</span>%
                        </div>
                    </div>
                </div>
            `;
            
            this.statsElement.appendChild(this.graphCanvas);
            this.container.appendChild(this.statsElement);
        }

        const cpuLoads = this.servers.map(server => server.getCurrentLoad().cpu);
        const memoryLoads = this.servers.map(server => server.getCurrentLoad().memory);
        
        const cpuBalance = this.calculateBalanceScore(cpuLoads);
        const memoryBalance = this.calculateBalanceScore(memoryLoads);

        // Update current values
        document.getElementById(`cpuValue-${this.containerId}`).textContent = cpuBalance;
        document.getElementById(`memValue-${this.containerId}`).textContent = memoryBalance;

        // Update history arrays
        this.cpuBalanceHistory.push(cpuBalance);
        this.memoryBalanceHistory.push(memoryBalance);
        
        if (this.cpuBalanceHistory.length > this.maxDataPoints) {
            this.cpuBalanceHistory.shift();
            this.memoryBalanceHistory.shift();
        }

        // Draw graphs
        const ctx = this.graphCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.graphCanvas.width, this.graphCanvas.height);

        // Set up graph area with smaller padding
        const padding = {
            left: 25,
            right: 5,
            top: 5,
            bottom: 15
        };
        const graphWidth = this.graphCanvas.width - (padding.left + padding.right);
        const graphHeight = this.graphCanvas.height - (padding.top + padding.bottom);

        // Draw y-axis and labels with smaller font
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '9px Arial';

        // Draw y-axis line
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, this.graphCanvas.height - padding.bottom);
        ctx.stroke();

        // Draw y-axis labels and grid lines
        for (let i = 0; i <= 100; i += 25) {
            const y = padding.top + (graphHeight * (1 - i/100));
            
            // Grid line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(this.graphCanvas.width - padding.right, y);
            ctx.stroke();
            
            // Label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(i + '%', padding.left - 3, y);
        }

        // Draw x-axis and time labels
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '9px Arial';

        // Draw x-axis line
        ctx.beginPath();
        ctx.moveTo(padding.left, this.graphCanvas.height - padding.bottom);
        ctx.lineTo(this.graphCanvas.width - padding.right, this.graphCanvas.height - padding.bottom);
        ctx.stroke();

        // Draw x-axis time labels
        const timePoints = [0, 50];
        timePoints.forEach(point => {
            const x = padding.left + (point * graphWidth / 50);
            ctx.fillText(`${point}s`, x, this.graphCanvas.height - padding.bottom + 3);
        });

        // Function to draw a line graph
        const drawLine = (data, color) => {
            if (data.length < 2) return;  // Need at least 2 points to draw a line
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            
            data.forEach((value, index) => {
                const x = padding.left + (index * (graphWidth / (this.maxDataPoints - 1)));
                const y = padding.top + (graphHeight * (1 - value/100));
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        };

        // Draw CPU and Memory lines
        drawLine(this.cpuBalanceHistory, '#4CAF50');
        drawLine(this.memoryBalanceHistory, '#FF6B6B');
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update server loads and stats
        const loads = this.servers.map(server => server.getCurrentLoad());
        const cpuLoads = loads.map(load => load.cpu);
        const memoryLoads = loads.map(load => load.memory);
        
        const cpuStats = this.calculateStats(cpuLoads);
        const memoryStats = this.calculateStats(memoryLoads);

        // Update stats display
        this.updateStatsDisplay(cpuStats, memoryStats);

        // Update server visuals
        this.updateServerVisuals();
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    setNumServers(count) {
        this.numServers = count;
        this.currentServerIndex = 0;
        this.initializeServers();
    }

    clearRequests() {
        // Remove all request meshes from the scene
        this.scene.children.forEach(child => {
            if (child.isRequest) {
                this.scene.remove(child);
            }
        });

        // Reset server loads
        this.servers.forEach(server => {
            server.requests = [];
            server.rejectedRequests = 0;
            server.cpuBar.scale.x = 0;
            server.memoryBar.scale.x = 0;
        });

        // Reset counters
        this.requestCount = 0;
        this.totalRejectedRequests = 0;
        if (this.rejectionCounter) {
            this.rejectionCounter.lastChild.textContent = `Rejected: 0`;
        }
    }
}

// Create simulations
const algorithms = {
    'Round Robin': new RoundRobinAlgorithm(),
    'Random': new RandomAlgorithm(),
    'Least Requests': new LeastRequestsAlgorithm(),
    'Least Response Time': new LeastResponseTimeAlgorithm(),
    'Dynamic CPU': new DynamicAlgorithm()
};

// Create single simulation with Round Robin as default
const simulation = new LoadBalancerSimulation('sim1', algorithms['Round Robin']);

// Global controls
let autoRequestInterval = null;
let simulationTimer = null;
const toggleBtn = document.getElementById('toggleBtn');
const resetBtn = document.getElementById('resetBtn');
const rateControl = document.getElementById('rateControl');
const rateValue = document.getElementById('rateValue');
const serverControl = document.getElementById('serverControl');
const serverValue = document.getElementById('serverValue');
const algorithmSelect = document.getElementById('algorithmSelect');
const runTimeControl = document.getElementById('runTimeControl');
const timeLeftValue = document.getElementById('timeLeftValue');
let currentInterval = 1000;
let remainingTime = 0;

// Initial values
const initialValues = {
    rate: 1.0,
    servers: 4,
    algorithm: 'Round Robin',
    runTime: 60
};

// Initialize algorithm dropdown
Object.keys(algorithms).forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    algorithmSelect.appendChild(option);
});

// Function to stop the simulation
function stopSimulation() {
    if (autoRequestInterval) {
        clearInterval(autoRequestInterval);
        autoRequestInterval = null;
    }
    if (simulationTimer) {
        clearInterval(simulationTimer);
        simulationTimer = null;
    }
    toggleBtn.textContent = 'Start';
    toggleBtn.classList.remove('running');
    timeLeftValue.textContent = `${runTimeControl.value}s left`;
    remainingTime = 0;
}

// Reset function
function resetSimulation() {
    // Stop the simulation if it's running
    stopSimulation();

    // Reset rate control
    rateControl.value = initialValues.rate;
    rateValue.textContent = initialValues.rate.toFixed(1);
    currentInterval = 1000 / initialValues.rate;

    // Reset server control
    serverControl.value = initialValues.servers;
    serverValue.textContent = initialValues.servers;
    simulation.setNumServers(initialValues.servers);

    // Reset algorithm
    algorithmSelect.value = initialValues.algorithm;
    simulation.algorithm = algorithms[initialValues.algorithm];

    // Reset run time
    runTimeControl.value = initialValues.runTime;
    timeLeftValue.textContent = `${initialValues.runTime}s left`;

    // Clear any existing requests
    simulation.clearRequests();
}

// Add reset button handler
resetBtn.addEventListener('click', resetSimulation);

// Handle algorithm change
algorithmSelect.addEventListener('change', (e) => {
    simulation.algorithm = algorithms[e.target.value];
});

rateControl.addEventListener('input', (e) => {
    const rate = parseFloat(e.target.value);
    rateValue.textContent = rate.toFixed(1);
    
    if (autoRequestInterval) {
        clearInterval(autoRequestInterval);
        currentInterval = 1000 / rate;
        autoRequestInterval = setInterval(() => {
            simulation.createRequest();
        }, currentInterval);
    }
});

serverControl.addEventListener('input', (e) => {
    const count = parseInt(e.target.value);
    serverValue.textContent = count;
    simulation.setNumServers(count);
});

toggleBtn.addEventListener('click', () => {
    if (!autoRequestInterval) {
        // Start simulation
        const rate = parseFloat(rateControl.value);
        currentInterval = 1000 / rate;
        remainingTime = parseInt(runTimeControl.value);
        
        autoRequestInterval = setInterval(() => {
            simulation.createRequest();
        }, currentInterval);
        
        simulationTimer = setInterval(() => {
            remainingTime--;
            timeLeftValue.textContent = `${remainingTime}s left`;
            
            if (remainingTime <= 0) {
                stopSimulation();
            }
        }, 1000);
        
        toggleBtn.textContent = 'Stop';
        toggleBtn.classList.add('running');
    } else {
        // Stop simulation
        stopSimulation();
    }
});

// Handle run time input
runTimeControl.addEventListener('input', (e) => {
    const time = parseInt(e.target.value);
    if (!autoRequestInterval) {
        timeLeftValue.textContent = `${time}s left`;
    }
});

window.addEventListener('resize', () => {
    const container = document.getElementById(simulation.containerId);
    const aspect = container.clientWidth / container.clientHeight;
    
    simulation.camera.left = -45 * aspect;
    simulation.camera.right = 45 * aspect;
    simulation.camera.top = 15;
    simulation.camera.bottom = -25;
    
    simulation.camera.updateProjectionMatrix();
    simulation.renderer.setSize(container.clientWidth, container.clientHeight);
});