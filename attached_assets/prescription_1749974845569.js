// MediTranslate+ Prescription Scanner Module
class PrescriptionScanner {
    constructor() {
        this.stream = null;
        this.isScanning = false;
        this.scanResults = null;
        this.currentImage = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.checkCameraSupport();
        this.checkQuickScanMode();
    }
    
    setupEventListeners() {
        // Drag and drop for upload area
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('border-primary');
            });
            
            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('border-primary');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('border-primary');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleImageFile(files[0]);
                }
            });
            
            // Click to upload
            uploadArea.addEventListener('click', () => {
                document.getElementById('imageInput').click();
            });
        }
        
        // Check online status for features
        this.updateOfflineStatus();
        window.addEventListener('online', () => this.updateOfflineStatus());
        window.addEventListener('offline', () => this.updateOfflineStatus());
    }
    
    checkCameraSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('Camera not supported');
            this.hideCameraFeatures();
        }
    }
    
    checkQuickScanMode() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('quick') === 'true') {
            setTimeout(() => this.openCamera(), 1000);
        }
    }
    
    hideCameraFeatures() {
        const cameraButtons = document.querySelectorAll('[onclick*="Camera"]');
        cameraButtons.forEach(btn => {
            btn.style.display = 'none';
        });
    }
    
    updateOfflineStatus() {
        const offlineFallback = document.getElementById('offlineFallback');
        if (offlineFallback) {
            if (!navigator.onLine) {
                offlineFallback.style.display = 'block';
            } else {
                offlineFallback.style.display = 'none';
            }
        }
    }
    
    async openCamera() {
        const cameraView = document.getElementById('cameraView');
        const uploadArea = document.getElementById('uploadArea');
        const video = document.getElementById('video');
        
        if (!cameraView || !video) {
            MediTranslate.showNotification('Camera interface not available', 'error');
            return;
        }
        
        try {
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera if available
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            video.srcObject = this.stream;
            
            // Show camera view, hide upload area
            cameraView.style.display = 'block';
            if (uploadArea) uploadArea.style.display = 'none';
            
            MediTranslate.showNotification('Camera ready. Position prescription in frame.', 'success');
            
        } catch (error) {
            console.error('Camera access error:', error);
            
            let errorMessage = 'Camera access denied. ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Please allow camera permissions and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No camera found on this device.';
            } else {
                errorMessage += 'Please try uploading an image instead.';
            }
            
            MediTranslate.showNotification(errorMessage, 'error');
            this.showUploadOption();
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        const cameraView = document.getElementById('cameraView');
        const uploadArea = document.getElementById('uploadArea');
        
        if (cameraView) cameraView.style.display = 'none';
        if (uploadArea) uploadArea.style.display = 'block';
    }
    
    capturePhoto() {
        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const previewImage = document.getElementById('previewImage');
        const previewSection = document.getElementById('previewSection');
        
        if (!video || !canvas || !previewImage) {
            MediTranslate.showNotification('Photo capture failed', 'error');
            return;
        }
        
        try {
            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Draw video frame to canvas
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert to blob
            canvas.toBlob((blob) => {
                if (blob) {
                    this.currentImage = blob;
                    
                    // Show preview
                    const imageUrl = URL.createObjectURL(blob);
                    previewImage.src = imageUrl;
                    previewSection.style.display = 'block';
                    
                    // Stop camera
                    this.stopCamera();
                    
                    // Scroll to preview
                    previewSection.scrollIntoView({ behavior: 'smooth' });
                    
                    MediTranslate.showNotification('Photo captured successfully!', 'success');
                } else {
                    MediTranslate.showNotification('Failed to capture photo', 'error');
                }
            }, 'image/jpeg', 0.8);
            
        } catch (error) {
            console.error('Photo capture error:', error);
            MediTranslate.showNotification('Photo capture failed', 'error');
        }
    }
    
    uploadImage() {
        document.getElementById('imageInput').click();
    }
    
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.handleImageFile(file);
        }
    }
    
    handleImageFile(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            MediTranslate.showNotification('Please select a valid image file', 'warning');
            return;
        }
        
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            MediTranslate.showNotification('Image file too large. Please select a smaller image.', 'warning');
            return;
        }
        
        this.currentImage = file;
        
        // Show preview
        const previewImage = document.getElementById('previewImage');
        const previewSection = document.getElementById('previewSection');
        
        if (previewImage && previewSection) {
            const imageUrl = URL.createObjectURL(file);
            previewImage.src = imageUrl;
            previewSection.style.display = 'block';
            
            // Hide upload area
            const uploadArea = document.getElementById('uploadArea');
            if (uploadArea) uploadArea.style.display = 'none';
            
            // Scroll to preview
            previewSection.scrollIntoView({ behavior: 'smooth' });
            
            MediTranslate.showNotification('Image uploaded successfully!', 'success');
        }
    }
    
    async scanPrescription() {
        if (!this.currentImage) {
            MediTranslate.showNotification('No image to scan', 'warning');
            return;
        }
        
        if (!navigator.onLine) {
            MediTranslate.showNotification('OCR scanning requires internet connection', 'warning');
            this.showManualEntry();
            return;
        }
        
        const scanningProgress = document.getElementById('scanningProgress');
        const progressBar = document.getElementById('progressBar');
        const scanResults = document.getElementById('scanResults');
        
        try {
            this.isScanning = true;
            
            // Show progress
            if (scanningProgress) scanningProgress.style.display = 'block';
            if (scanResults) scanResults.style.display = 'none';
            
            // Simulate progress
            this.animateProgress(progressBar);
            
            // Prepare form data
            const formData = new FormData();
            formData.append('image', this.currentImage);
            
            // Make API call
            const response = await fetch('/api/scan-prescription', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            // Display results
            this.displayScanResults(result);
            this.scanResults = result;
            
        } catch (error) {
            console.error('Prescription scan error:', error);
            
            if (error.message.includes('No text')) {
                MediTranslate.showNotification('No text found in image. Please try a clearer photo or manual entry.', 'warning');
                this.showManualEntry();
            } else {
                MediTranslate.showNotification('Scan failed. Please try manual entry.', 'error');
                this.showManualEntry();
            }
        } finally {
            this.isScanning = false;
            if (scanningProgress) scanningProgress.style.display = 'none';
        }
    }
    
    animateProgress(progressBar) {
        if (!progressBar) return;
        
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 90 || !this.isScanning) {
                clearInterval(interval);
                if (this.isScanning) {
                    progressBar.style.width = '100%';
                }
                return;
            }
            
            width += Math.random() * 15;
            progressBar.style.width = Math.min(width, 90) + '%';
        }, 500);
    }
    
    displayScanResults(results) {
        const scanResults = document.getElementById('scanResults');
        const extractedText = document.getElementById('extractedText');
        const medicationsList = document.getElementById('medicationsList');
        const dosagesList = document.getElementById('dosagesList');
        const instructionsText = document.getElementById('instructionsText');
        
        if (!scanResults) return;
        
        // Display extracted text
        if (extractedText) {
            extractedText.textContent = results.raw_text || 'No text extracted';
        }
        
        // Display medications
        if (medicationsList) {
            const medications = results.medications || [];
            if (medications.length > 0) {
                medicationsList.innerHTML = medications.map(med => `
                    <div class="list-group-item d-flex align-items-center">
                        <i class="fas fa-pills text-primary me-3"></i>
                        <span>${this.escapeHtml(med)}</span>
                    </div>
                `).join('');
            } else {
                medicationsList.innerHTML = '<div class="list-group-item text-muted">No medications detected</div>';
            }
        }
        
        // Display dosages
        if (dosagesList) {
            const dosages = results.dosages || [];
            if (dosages.length > 0) {
                dosagesList.innerHTML = dosages.map(dosage => `
                    <div class="list-group-item d-flex align-items-center">
                        <i class="fas fa-prescription-bottle-alt text-info me-3"></i>
                        <span>${this.escapeHtml(dosage)}</span>
                    </div>
                `).join('');
            } else {
                dosagesList.innerHTML = '<div class="list-group-item text-muted">No dosages detected</div>';
            }
        }
        
        // Display instructions
        if (instructionsText) {
            instructionsText.innerHTML = `
                <i class="fas fa-info-circle me-2"></i>
                ${this.escapeHtml(results.instructions || 'No specific instructions found')}
            `;
        }
        
        // Show results
        scanResults.style.display = 'block';
        scanResults.scrollIntoView({ behavior: 'smooth' });
        
        MediTranslate.showNotification('Prescription scanned successfully!', 'success');
    }
    
    createReminders() {
        if (!this.scanResults) {
            MediTranslate.showNotification('No scan results to create reminders from', 'warning');
            return;
        }
        
        const medications = this.scanResults.medications || [];
        const dosages = this.scanResults.dosages || [];
        
        if (medications.length === 0) {
            MediTranslate.showNotification('No medications found to create reminders', 'warning');
            return;
        }
        
        // Redirect to reminders page with pre-filled data
        const params = new URLSearchParams();
        params.set('medications', JSON.stringify(medications));
        params.set('dosages', JSON.stringify(dosages));
        params.set('instructions', this.scanResults.instructions || '');
        
        window.location.href = `/reminders?${params.toString()}`;
    }
    
    translateResults() {
        if (!this.scanResults || !this.scanResults.raw_text) {
            MediTranslate.showNotification('No text to translate', 'warning');
            return;
        }
        
        // Redirect to translator with extracted text
        const params = new URLSearchParams();
        params.set('text', this.scanResults.raw_text);
        
        window.location.href = `/translator?${params.toString()}`;
    }
    
    saveResults() {
        if (!this.scanResults) {
            MediTranslate.showNotification('No results to save', 'warning');
            return;
        }
        
        // Save to local storage
        const savedScans = MediTranslate.loadFromLocalStorage('prescriptionScans') || [];
        const scanData = {
            ...this.scanResults,
            timestamp: new Date().toISOString(),
            id: Date.now()
        };
        
        savedScans.unshift(scanData);
        
        // Keep only last 10 scans
        if (savedScans.length > 10) {
            savedScans.splice(10);
        }
        
        MediTranslate.saveToLocalStorage('prescriptionScans', savedScans);
        MediTranslate.showNotification('Prescription scan saved successfully!', 'success');
    }
    
    scanAnother() {
        // Reset state
        this.currentImage = null;
        this.scanResults = null;
        
        // Hide sections
        const previewSection = document.getElementById('previewSection');
        const scanResults = document.getElementById('scanResults');
        const uploadArea = document.getElementById('uploadArea');
        const manualEntryForm = document.getElementById('manualEntryForm');
        
        if (previewSection) previewSection.style.display = 'none';
        if (scanResults) scanResults.style.display = 'none';
        if (manualEntryForm) manualEntryForm.style.display = 'none';
        if (uploadArea) uploadArea.style.display = 'block';
        
        // Clear file input
        const imageInput = document.getElementById('imageInput');
        if (imageInput) imageInput.value = '';
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    showManualEntry() {
        const manualEntryForm = document.getElementById('manualEntryForm');
        if (manualEntryForm) {
            manualEntryForm.style.display = 'block';
            manualEntryForm.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    manualEntry() {
        this.showManualEntry();
    }
    
    saveManualEntry() {
        const medName = document.getElementById('medName');
        const medDosage = document.getElementById('medDosage');
        const medFrequency = document.getElementById('medFrequency');
        const medInstructions = document.getElementById('medInstructions');
        
        if (!medName || !medName.value.trim()) {
            MediTranslate.showNotification('Please enter medication name', 'warning');
            if (medName) medName.focus();
            return;
        }
        
        if (!medDosage || !medDosage.value.trim()) {
            MediTranslate.showNotification('Please enter dosage', 'warning');
            if (medDosage) medDosage.focus();
            return;
        }
        
        // Create manual entry data
        const manualData = {
            medications: [medName.value.trim()],
            dosages: [medDosage.value.trim()],
            frequency: medFrequency ? medFrequency.value : 'twice_daily',
            instructions: medInstructions ? medInstructions.value.trim() : '',
            raw_text: `Manual Entry - ${medName.value.trim()}: ${medDosage.value.trim()}`,
            timestamp: new Date().toISOString(),
            source: 'manual'
        };
        
        // Save manual entry
        const savedScans = MediTranslate.loadFromLocalStorage('prescriptionScans') || [];
        savedScans.unshift(manualData);
        
        if (savedScans.length > 10) {
            savedScans.splice(10);
        }
        
        MediTranslate.saveToLocalStorage('prescriptionScans', savedScans);
        
        // Redirect to create reminder
        const params = new URLSearchParams();
        params.set('medication_name', manualData.medications[0]);
        params.set('dosage', manualData.dosages[0]);
        params.set('frequency', manualData.frequency);
        params.set('notes', manualData.instructions);
        
        MediTranslate.showNotification('Manual entry saved! Redirecting to create reminder...', 'success');
        
        setTimeout(() => {
            window.location.href = `/reminders?${params.toString()}`;
        }, 1500);
    }
    
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Global functions for button onclick handlers
function openCamera() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.openCamera();
    }
}

function uploadImage() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.uploadImage();
    }
}

function capturePhoto() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.capturePhoto();
    }
}

function stopCamera() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.stopCamera();
    }
}

function scanPrescription() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.scanPrescription();
    }
}

function createReminders() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.createReminders();
    }
}

function translateResults() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.translateResults();
    }
}

function saveResults() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.saveResults();
    }
}

function scanAnother() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.scanAnother();
    }
}

function manualEntry() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.manualEntry();
    }
}

function saveManualEntry() {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.saveManualEntry();
    }
}

function handleImageUpload(event) {
    if (window.prescriptionScanner) {
        window.prescriptionScanner.handleImageUpload(event);
    }
}

// Initialize prescription scanner when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.prescriptionScanner = new PrescriptionScanner();
});
