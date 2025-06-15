// MediTranslate+ Prescription Scanner Module

class PrescriptionScanner {
    constructor() {
        this.stream = null;
        this.isScanning = false;
        this.scannedResults = null;
        this.canvas = null;
        this.context = null;
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.checkQuickScanMode();
    }

    setupCanvas() {
        this.canvas = document.getElementById('canvas');
        if (this.canvas) {
            this.context = this.canvas.getContext('2d');
        }
    }

    setupEventListeners() {
        const imageInput = document.getElementById('imageInput');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }
    }

    setupDragAndDrop() {
        const uploadZone = document.querySelector('.upload-zone');
        if (uploadZone) {
            uploadZone.addEventListener('dragover', (e) => this.dragOverHandler(e));
            uploadZone.addEventListener('drop', (e) => this.dropHandler(e));
            uploadZone.addEventListener('dragleave', (e) => this.dragLeaveHandler(e));
            uploadZone.addEventListener('click', () => {
                document.getElementById('imageInput').click();
            });
        }
    }

    checkQuickScanMode() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('quick') === 'true') {
            setTimeout(() => this.openCamera(), 500);
        }
    }

    dragOverHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('dragover');
    }

    dragLeaveHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('dragover');
    }

    dropHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                this.processImageFile(file);
            } else {
                MediTranslate.showNotification('Please drop an image file', 'warning');
            }
        }
    }

    async openCamera() {
        const cameraView = document.getElementById('cameraView');
        const uploadArea = document.getElementById('uploadArea');
        const video = document.getElementById('video');

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            MediTranslate.showNotification('Camera not supported in this browser', 'danger');
            return;
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera if available
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            if (video) {
                video.srcObject = this.stream;
                video.play();
            }

            if (cameraView) cameraView.style.display = 'block';
            if (uploadArea) uploadArea.style.display = 'none';

        } catch (error) {
            console.error('Error accessing camera:', error);
            MediTranslate.showNotification('Unable to access camera. Please try uploading an image instead.', 'danger');
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
        const canvas = this.canvas;

        if (!video || !canvas) return;

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        this.context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas to blob
        canvas.toBlob((blob) => {
            if (blob) {
                this.processImageBlob(blob);
                this.stopCamera();
            }
        }, 'image/jpeg', 0.8);
    }

    uploadImage() {
        const imageInput = document.getElementById('imageInput');
        if (imageInput) {
            imageInput.click();
        }
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.processImageFile(file);
        }
    }

    processImageFile(file) {
        if (!file.type.startsWith('image/')) {
            MediTranslate.showNotification('Please select an image file', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.showImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    processImageBlob(blob) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.showImagePreview(e.target.result);
        };
        reader.readAsDataURL(blob);
    }

    showImagePreview(imageSrc) {
        const previewSection = document.getElementById('previewSection');
        const previewImage = document.getElementById('previewImage');

        if (previewImage) {
            previewImage.src = imageSrc;
            previewImage.onload = () => {
                if (previewSection) {
                    previewSection.style.display = 'block';
                    previewSection.scrollIntoView({ behavior: 'smooth' });
                }
            };
        }
    }

    async scanPrescription() {
        const previewImage = document.getElementById('previewImage');
        const scanningProgress = document.getElementById('scanningProgress');
        const scanResults = document.getElementById('scanResults');
        const progressBar = document.getElementById('progressBar');

        if (!previewImage || !previewImage.src) {
            MediTranslate.showNotification('No image to scan', 'warning');
            return;
        }

        // Show progress
        if (scanningProgress) scanningProgress.style.display = 'block';
        if (scanResults) scanResults.style.display = 'none';

        // Simulate progress
        this.animateProgress(progressBar);

        try {
            // Convert image to blob
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to image size
            canvas.width = previewImage.naturalWidth;
            canvas.height = previewImage.naturalHeight;
            
            // Draw image to canvas
            ctx.drawImage(previewImage, 0, 0);
            
            // Convert to blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 0.8);
            });

            // Create FormData
            const formData = new FormData();
            formData.append('image', blob, 'prescription.jpg');

            // Send to server
            const response = await fetch('/api/scan-prescription', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && !data.error) {
                this.displayScanResults(data);
            } else if (data.needs_setup) {
                this.showAPISetupNotice(data.message);
            } else {
                throw new Error(data.error || 'Scanning failed');
            }

        } catch (error) {
            console.error('Prescription scan error:', error);
            MediTranslate.showNotification('Scanning failed. Please try again or use manual entry.', 'danger');
            this.showOfflineFallback();
        } finally {
            if (scanningProgress) scanningProgress.style.display = 'none';
        }
    }

    showAPISetupNotice(message) {
        const noticeHtml = `
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <i class="fas fa-key me-2"></i>
                <strong>AI Setup Required:</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertAdjacentHTML('afterbegin', noticeHtml);
        }
    }

    animateProgress(progressBar) {
        if (!progressBar) return;

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) {
                progress = 90;
                clearInterval(interval);
            }
            progressBar.style.width = `${progress}%`;
        }, 200);

        // Complete progress after scan
        setTimeout(() => {
            clearInterval(interval);
            progressBar.style.width = '100%';
        }, 3000);
    }

    displayScanResults(data) {
        const scanResults = document.getElementById('scanResults');
        const extractedText = document.getElementById('extractedText');
        const medicationsList = document.getElementById('medicationsList');
        const dosagesList = document.getElementById('dosagesList');
        const instructionsText = document.getElementById('instructionsText');

        // Store results
        this.scannedResults = data;

        // Display extracted text
        if (extractedText) {
            extractedText.textContent = data.extracted_text || 'No text extracted';
        }

        // Display medications
        if (medicationsList && data.medications) {
            medicationsList.innerHTML = data.medications.map((med, index) => `
                <div class="list-group-item d-flex justify-content-between align-items-center fade-in-up" style="animation-delay: ${index * 0.1}s;">
                    <div>
                        <i class="fas fa-pills text-primary me-2"></i>
                        ${med}
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="scanner.addMedicationReminder('${med}', ${index})">
                        <i class="fas fa-bell"></i>
                    </button>
                </div>
            `).join('');
        }

        // Display dosages
        if (dosagesList && data.dosages) {
            dosagesList.innerHTML = data.dosages.map((dosage, index) => `
                <div class="list-group-item fade-in-up" style="animation-delay: ${index * 0.1}s;">
                    <i class="fas fa-prescription-bottle text-info me-2"></i>
                    ${dosage}
                </div>
            `).join('');
        }

        // Display instructions
        if (instructionsText) {
            instructionsText.textContent = data.instructions || 'No specific instructions found';
        }

        // Show results
        if (scanResults) {
            scanResults.style.display = 'block';
            scanResults.scrollIntoView({ behavior: 'smooth' });
        }
    }

    addMedicationReminder(medication, index) {
        const dosage = this.scannedResults?.dosages?.[index] || 'As prescribed';
        
        // Store in localStorage for reminders page
        const reminderData = {
            medication_name: medication,
            dosage: dosage,
            frequency: 'twice_daily',
            notes: 'Added from prescription scan',
            source: 'prescription_scan'
        };
        
        localStorage.setItem('pendingReminder', JSON.stringify(reminderData));
        
        // Redirect to reminders page
        window.location.href = '/reminders?from=scan';
    }

    createReminders() {
        if (!this.scannedResults || !this.scannedResults.medications) {
            MediTranslate.showNotification('No medications found to create reminders', 'warning');
            return;
        }

        // Store all medications for batch creation
        const reminders = this.scannedResults.medications.map((med, index) => ({
            medication_name: med,
            dosage: this.scannedResults.dosages?.[index] || 'As prescribed',
            frequency: 'twice_daily',
            notes: 'Added from prescription scan',
            source: 'prescription_scan'
        }));

        localStorage.setItem('batchReminders', JSON.stringify(reminders));
        window.location.href = '/reminders?from=scan&batch=true';
    }

    translateResults() {
        if (!this.scannedResults) {
            MediTranslate.showNotification('No scan results to translate', 'warning');
            return;
        }

        const textToTranslate = [
            this.scannedResults.extracted_text,
            ...(this.scannedResults.medications || []),
            this.scannedResults.instructions
        ].filter(Boolean).join('\n\n');

        localStorage.setItem('translateText', textToTranslate);
        window.location.href = '/translator';
    }

    saveResults() {
        if (!this.scannedResults) {
            MediTranslate.showNotification('No results to save', 'warning');
            return;
        }

        // Save to localStorage
        const savedScans = JSON.parse(localStorage.getItem('savedPrescriptionScans') || '[]');
        const scanData = {
            ...this.scannedResults,
            timestamp: new Date().toISOString(),
            id: 'scan_' + Date.now()
        };

        savedScans.unshift(scanData);
        
        // Keep only last 20 scans
        if (savedScans.length > 20) {
            savedScans.splice(20);
        }

        localStorage.setItem('savedPrescriptionScans', JSON.stringify(savedScans));
        MediTranslate.showNotification('Scan results saved successfully', 'success');
    }

    scanAnother() {
        // Reset UI to initial state
        const previewSection = document.getElementById('previewSection');
        const scanResults = document.getElementById('scanResults');
        const cameraView = document.getElementById('cameraView');
        const uploadArea = document.getElementById('uploadArea');

        if (previewSection) previewSection.style.display = 'none';
        if (scanResults) scanResults.style.display = 'none';
        if (cameraView) cameraView.style.display = 'none';
        if (uploadArea) uploadArea.style.display = 'block';

        // Clear form
        const imageInput = document.getElementById('imageInput');
        if (imageInput) imageInput.value = '';

        this.scannedResults = null;
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showOfflineFallback() {
        const offlineFallback = document.getElementById('offlineFallback');
        if (offlineFallback) {
            offlineFallback.style.display = 'block';
            offlineFallback.scrollIntoView({ behavior: 'smooth' });
        }
    }

    manualEntry() {
        const manualEntryForm = document.getElementById('manualEntryForm');
        const offlineFallback = document.getElementById('offlineFallback');
        
        if (manualEntryForm) {
            manualEntryForm.style.display = 'block';
            manualEntryForm.scrollIntoView({ behavior: 'smooth' });
        }
        
        if (offlineFallback) {
            offlineFallback.style.display = 'none';
        }
    }

    saveManualEntry() {
        const medName = document.getElementById('medName')?.value;
        const medDosage = document.getElementById('medDosage')?.value;
        const medFrequency = document.getElementById('medFrequency')?.value;
        const medInstructions = document.getElementById('medInstructions')?.value;

        if (!medName || !medDosage) {
            MediTranslate.showNotification('Please fill in medication name and dosage', 'warning');
            return;
        }

        const reminderData = {
            medication_name: medName,
            dosage: medDosage,
            frequency: medFrequency,
            notes: medInstructions || 'Manually entered',
            source: 'manual_entry'
        };

        localStorage.setItem('pendingReminder', JSON.stringify(reminderData));
        
        MediTranslate.showNotification('Prescription saved! Redirecting to set up reminders...', 'success');
        
        setTimeout(() => {
            window.location.href = '/reminders?from=manual';
        }, 1500);
    }
}

// Global functions
window.openCamera = () => scanner.openCamera();
window.stopCamera = () => scanner.stopCamera();
window.capturePhoto = () => scanner.capturePhoto();
window.uploadImage = () => scanner.uploadImage();
window.handleImageUpload = (event) => scanner.handleImageUpload(event);
window.scanPrescription = () => scanner.scanPrescription();
window.createReminders = () => scanner.createReminders();
window.translateResults = () => scanner.translateResults();
window.saveResults = () => scanner.saveResults();
window.scanAnother = () => scanner.scanAnother();
window.manualEntry = () => scanner.manualEntry();
window.saveManualEntry = () => scanner.saveManualEntry();
window.dragOverHandler = (e) => scanner.dragOverHandler(e);
window.dropHandler = (e) => scanner.dropHandler(e);

// Initialize scanner
const scanner = new PrescriptionScanner();
