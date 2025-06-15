// MediTranslate+ Reminders Module
class MedicationReminders {
    constructor() {
        this.reminders = [];
        this.todaySchedule = [];
        this.notificationPermission = null;
        this.reminderIntervals = new Map();
        
        this.init();
    }
    
    init() {
        this.loadReminders();
        this.setupEventListeners();
        this.requestNotificationPermission();
        this.updateStats();
        this.generateTodaySchedule();
        this.checkUrlParams();
        this.startReminderChecks();
    }
    
    setupEventListeners() {
        const reminderForm = document.getElementById('reminderForm');
        if (reminderForm) {
            reminderForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addReminder();
            });
        }
        
        // Frequency change handler
        const frequencySelect = document.getElementById('reminderFrequency');
        if (frequencySelect) {
            frequencySelect.addEventListener('change', () => {
                this.updateTimeSlots();
            });
        }
        
        // Check for today's view parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('view') === 'today') {
            this.scrollToTodaySchedule();
        }
    }
    
    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Pre-fill form from URL parameters (from prescription scan)
        const medications = urlParams.get('medications');
        const dosages = urlParams.get('dosages');
        const medName = urlParams.get('medication_name');
        const dosage = urlParams.get('dosage');
        const frequency = urlParams.get('frequency');
        const notes = urlParams.get('notes');
        
        if (medications && dosages) {
            try {
                const medList = JSON.parse(medications);
                const dosageList = JSON.parse(dosages);
                
                if (medList.length > 0) {
                    this.prefillFromScan(medList, dosageList, urlParams.get('instructions') || '');
                }
            } catch (error) {
                console.error('Error parsing URL parameters:', error);
            }
        } else if (medName && dosage) {
            this.prefillSingleMedication(medName, dosage, frequency, notes);
        }
    }
    
    prefillFromScan(medications, dosages, instructions) {
        // Show a modal or section to add multiple medications
        MediTranslate.showNotification('Adding medications from prescription scan...', 'info');
        
        // Add each medication automatically
        for (let i = 0; i < medications.length; i++) {
            const medication = medications[i];
            const dosage = dosages[i] || 'As prescribed';
            
            setTimeout(() => {
                this.addReminderFromData(medication, dosage, 'twice_daily', instructions);
            }, i * 1000); // Stagger the additions
        }
        
        // Scroll to reminders section
        setTimeout(() => {
            this.scrollToAddReminder();
        }, 2000);
    }
    
    prefillSingleMedication(medName, dosage, frequency, notes) {
        const reminderMedName = document.getElementById('reminderMedName');
        const reminderDosage = document.getElementById('reminderDosage');
        const reminderFrequency = document.getElementById('reminderFrequency');
        const reminderNotes = document.getElementById('reminderNotes');
        
        if (reminderMedName) reminderMedName.value = medName;
        if (reminderDosage) reminderDosage.value = dosage;
        if (reminderFrequency && frequency) reminderFrequency.value = frequency;
        if (reminderNotes && notes) reminderNotes.value = notes;
        
        this.updateTimeSlots();
        this.scrollToAddReminder();
        
        MediTranslate.showNotification('Form pre-filled from prescription data', 'success');
    }
    
    async requestNotificationPermission() {
        if ('Notification' in window) {
            this.notificationPermission = await Notification.requestPermission();
            if (this.notificationPermission === 'granted') {
                console.log('Notification permission granted');
            } else {
                MediTranslate.showNotification('Enable notifications for medication reminders', 'warning');
            }
        }
    }
    
    updateTimeSlots() {
        const frequency = document.getElementById('reminderFrequency');
        const timeSlotsContainer = document.getElementById('timeSlots');
        
        if (!frequency || !timeSlotsContainer) return;
        
        const frequencyValue = frequency.value;
        let slotsNeeded = 1;
        let defaultTimes = ['08:00'];
        
        switch (frequencyValue) {
            case 'once_daily':
                slotsNeeded = 1;
                defaultTimes = ['08:00'];
                break;
            case 'twice_daily':
                slotsNeeded = 2;
                defaultTimes = ['08:00', '20:00'];
                break;
            case 'three_times_daily':
                slotsNeeded = 3;
                defaultTimes = ['08:00', '14:00', '20:00'];
                break;
            case 'four_times_daily':
                slotsNeeded = 4;
                defaultTimes = ['08:00', '12:00', '16:00', '20:00'];
                break;
            case 'custom':
                slotsNeeded = 1;
                defaultTimes = ['08:00'];
                break;
        }
        
        // Clear existing time slots
        timeSlotsContainer.innerHTML = '';
        
        // Add new time slots
        for (let i = 0; i < slotsNeeded; i++) {
            const timeInput = document.createElement('input');
            timeInput.type = 'time';
            timeInput.className = 'form-control mb-2';
            timeInput.name = 'timeSlot';
            timeInput.value = defaultTimes[i] || '08:00';
            timeInput.required = true;
            
            timeSlotsContainer.appendChild(timeInput);
        }
        
        // Add custom slot button for custom frequency
        if (frequencyValue === 'custom') {
            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.className = 'btn btn-outline-primary btn-sm';
            addButton.innerHTML = '<i class="fas fa-plus me-1"></i>Add Time Slot';
            addButton.onclick = () => this.addCustomTimeSlot();
            
            timeSlotsContainer.appendChild(addButton);
        }
    }
    
    addCustomTimeSlot() {
        const timeSlotsContainer = document.getElementById('timeSlots');
        const addButton = timeSlotsContainer.querySelector('button');
        
        const timeInput = document.createElement('input');
        timeInput.type = 'time';
        timeInput.className = 'form-control mb-2';
        timeInput.name = 'timeSlot';
        timeInput.value = '08:00';
        timeInput.required = true;
        
        // Insert before the add button
        timeSlotsContainer.insertBefore(timeInput, addButton);
    }
    
    async addReminder() {
        const medName = document.getElementById('reminderMedName');
        const dosage = document.getElementById('reminderDosage');
        const frequency = document.getElementById('reminderFrequency');
        const notes = document.getElementById('reminderNotes');
        const timeSlots = document.querySelectorAll('#timeSlots input[name="timeSlot"]');
        
        if (!medName || !medName.value.trim()) {
            MediTranslate.showNotification('Please enter medication name', 'warning');
            if (medName) medName.focus();
            return;
        }
        
        if (!dosage || !dosage.value.trim()) {
            MediTranslate.showNotification('Please enter dosage', 'warning');
            if (dosage) dosage.focus();
            return;
        }
        
        if (timeSlots.length === 0) {
            MediTranslate.showNotification('Please set at least one time slot', 'warning');
            return;
        }
        
        const times = Array.from(timeSlots).map(slot => slot.value);
        
        const reminderData = {
            medication_name: medName.value.trim(),
            dosage: dosage.value.trim(),
            frequency: frequency ? frequency.value : 'once_daily',
            time_slots: times,
            notes: notes ? notes.value.trim() : ''
        };
        
        try {
            const response = await MediTranslate.makeAPIRequest('/api/reminders', {
                method: 'POST',
                body: JSON.stringify(reminderData)
            });
            
            MediTranslate.showNotification('Reminder added successfully!', 'success');
            
            // Reset form
            document.getElementById('reminderForm').reset();
            this.updateTimeSlots();
            
            // Reload page to show new reminder
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            
        } catch (error) {
            console.error('Add reminder error:', error);
            MediTranslate.showNotification('Failed to add reminder. Please try again.', 'error');
        }
    }
    
    async addReminderFromData(medName, dosage, frequency, notes) {
        const reminderData = {
            medication_name: medName,
            dosage: dosage,
            frequency: frequency,
            time_slots: this.getDefaultTimesForFrequency(frequency),
            notes: notes
        };
        
        try {
            await MediTranslate.makeAPIRequest('/api/reminders', {
                method: 'POST',
                body: JSON.stringify(reminderData)
            });
            
            MediTranslate.showNotification(`Added reminder for ${medName}`, 'success');
            
        } catch (error) {
            console.error('Add reminder error:', error);
            MediTranslate.showNotification(`Failed to add reminder for ${medName}`, 'error');
        }
    }
    
    getDefaultTimesForFrequency(frequency) {
        const timeMap = {
            'once_daily': ['08:00'],
            'twice_daily': ['08:00', '20:00'],
            'three_times_daily': ['08:00', '14:00', '20:00'],
            'four_times_daily': ['08:00', '12:00', '16:00', '20:00']
        };
        
        return timeMap[frequency] || ['08:00'];
    }
    
    async deleteReminder(reminderId) {
        if (!confirm('Are you sure you want to delete this reminder?')) {
            return;
        }
        
        try {
            await MediTranslate.makeAPIRequest(`/api/reminders/${reminderId}`, {
                method: 'DELETE'
            });
            
            MediTranslate.showNotification('Reminder deleted successfully!', 'success');
            
            // Remove from UI
            const reminderElement = document.querySelector(`[data-reminder-id="${reminderId}"]`);
            if (reminderElement) {
                reminderElement.remove();
            }
            
            this.updateStats();
            this.generateTodaySchedule();
            
        } catch (error) {
            console.error('Delete reminder error:', error);
            MediTranslate.showNotification('Failed to delete reminder. Please try again.', 'error');
        }
    }
    
    editReminder(reminderId) {
        // Find the reminder element
        const reminderElement = document.querySelector(`[data-reminder-id="${reminderId}"]`);
        if (!reminderElement) return;
        
        // Extract current data
        const medName = reminderElement.querySelector('h6').textContent;
        const details = reminderElement.querySelector('p').textContent;
        const notes = reminderElement.querySelector('.text-info');
        
        // Populate edit modal
        const editModal = document.getElementById('editReminderModal');
        const editMedName = document.getElementById('editMedName');
        const editReminderId = document.getElementById('editReminderId');
        
        if (editMedName) editMedName.value = medName;
        if (editReminderId) editReminderId.value = reminderId;
        
        // Parse dosage and frequency from details
        const dosageMatch = details.match(/Dosage:\s*([^|]+)/);
        const frequencyMatch = details.match(/Frequency:\s*(.+)/);
        
        if (dosageMatch) {
            const editDosage = document.getElementById('editDosage');
            if (editDosage) editDosage.value = dosageMatch[1].trim();
        }
        
        if (frequencyMatch) {
            const editFrequency = document.getElementById('editFrequency');
            if (editFrequency) {
                const freq = frequencyMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
                editFrequency.value = freq;
            }
        }
        
        if (notes) {
            const editNotes = document.getElementById('editNotes');
            if (editNotes) editNotes.value = notes.textContent.replace('Note: ', '');
        }
        
        // Show modal
        const modal = new bootstrap.Modal(editModal);
        modal.show();
    }
    
    async saveEditedReminder() {
        const editReminderId = document.getElementById('editReminderId');
        const editMedName = document.getElementById('editMedName');
        const editDosage = document.getElementById('editDosage');
        const editFrequency = document.getElementById('editFrequency');
        const editNotes = document.getElementById('editNotes');
        
        if (!editReminderId || !editMedName || !editDosage) {
            MediTranslate.showNotification('Missing required fields', 'warning');
            return;
        }
        
        const reminderData = {
            medication_name: editMedName.value.trim(),
            dosage: editDosage.value.trim(),
            frequency: editFrequency ? editFrequency.value : 'once_daily',
            notes: editNotes ? editNotes.value.trim() : ''
        };
        
        try {
            await MediTranslate.makeAPIRequest(`/api/reminders/${editReminderId.value}`, {
                method: 'PUT',
                body: JSON.stringify(reminderData)
            });
            
            MediTranslate.showNotification('Reminder updated successfully!', 'success');
            
            // Hide modal
            const editModal = bootstrap.Modal.getInstance(document.getElementById('editReminderModal'));
            if (editModal) editModal.hide();
            
            // Reload page
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            
        } catch (error) {
            console.error('Edit reminder error:', error);
            MediTranslate.showNotification('Failed to update reminder. Please try again.', 'error');
        }
    }
    
    loadReminders() {
        // Load from server-side rendered data or localStorage
        const reminderElements = document.querySelectorAll('[data-reminder-id]');
        this.reminders = Array.from(reminderElements).map(el => ({
            id: el.getAttribute('data-reminder-id'),
            element: el
        }));
    }
    
    updateStats() {
        // Count reminders
        const totalMeds = document.getElementById('totalMeds');
        const todayDoses = document.getElementById('todayDoses');
        const takenToday = document.getElementById('takenToday');
        const missedToday = document.getElementById('missedToday');
        
        const reminderCount = this.reminders.length;
        
        if (totalMeds) totalMeds.textContent = reminderCount;
        
        // Calculate today's doses
        let dosesCount = 0;
        this.reminders.forEach(reminder => {
            // This would need to parse the time slots from the reminder data
            dosesCount += 2; // Assuming average of 2 doses per medication
        });
        
        if (todayDoses) todayDoses.textContent = dosesCount;
        
        // Get taken/missed from localStorage
        const todayKey = new Date().toDateString();
        const todayData = MediTranslate.loadFromLocalStorage(`medicationLog_${todayKey}`) || {};
        
        if (takenToday) takenToday.textContent = Object.keys(todayData).filter(key => todayData[key] === 'taken').length;
        if (missedToday) missedToday.textContent = Object.keys(todayData).filter(key => todayData[key] === 'missed').length;
    }
    
    generateTodaySchedule() {
        const todayTimeline = document.getElementById('todayTimeline');
        const noScheduleToday = document.getElementById('noScheduleToday');
        
        if (!todayTimeline) return;
        
        // This would parse actual reminder data and generate timeline
        // For now, showing a placeholder
        if (this.reminders.length === 0) {
            if (noScheduleToday) noScheduleToday.style.display = 'block';
            return;
        }
        
        if (noScheduleToday) noScheduleToday.style.display = 'none';
        
        // Generate sample timeline (would be dynamic in real implementation)
        const sampleSchedule = [
            { time: '08:00', medication: 'Morning Medications', status: 'pending' },
            { time: '14:00', medication: 'Afternoon Dose', status: 'pending' },
            { time: '20:00', medication: 'Evening Medications', status: 'pending' }
        ];
        
        const timelineHTML = sampleSchedule.map(item => `
            <div class="timeline-item ${item.status}">
                <div class="timeline-marker ${item.status === 'taken' ? 'bg-success' : item.status === 'missed' ? 'bg-danger' : 'bg-primary'}"></div>
                <div class="timeline-content">
                    <div class="timeline-time">${item.time}</div>
                    <div class="timeline-medication">
                        <strong>${item.medication}</strong>
                        <div class="timeline-actions mt-2">
                            <button class="btn btn-sm btn-success me-2" onclick="reminders.markAsTaken('${item.time}')">
                                <i class="fas fa-check me-1"></i>Taken
                            </button>
                            <button class="btn btn-sm btn-warning me-2" onclick="reminders.snoozeReminder('${item.time}')">
                                <i class="fas fa-clock me-1"></i>Snooze
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="reminders.markAsMissed('${item.time}')">
                                <i class="fas fa-times me-1"></i>Missed
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        todayTimeline.innerHTML = timelineHTML;
    }
    
    startReminderChecks() {
        // Check for reminders every minute
        setInterval(() => {
            this.checkForReminders();
        }, 60000); // Check every minute
        
        // Initial check
        this.checkForReminders();
    }
    
    checkForReminders() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // Check if any reminders are due
        // This would integrate with the actual reminder data from the backend
        const dueReminders = this.findDueReminders(currentTime);
        
        dueReminders.forEach(reminder => {
            this.showReminderAlert(reminder);
        });
    }
    
    findDueReminders(currentTime) {
        // This would parse actual reminder times and return due reminders
        // For now, returning empty array
        return [];
    }
    
    showReminderAlert(reminder) {
        if (this.notificationPermission === 'granted') {
            const notification = new Notification('Medication Reminder', {
                body: `Time to take ${reminder.medication_name}: ${reminder.dosage}`,
                icon: '/static/favicon.ico',
                badge: '/static/favicon.ico',
                tag: `reminder-${reminder.id}`,
                requireInteraction: true
            });
            
            notification.onclick = () => {
                window.focus();
                this.showReminderModal(reminder);
                notification.close();
            };
        }
        
        // Also show in-app modal
        this.showReminderModal(reminder);
    }
    
    showReminderModal(reminder) {
        const reminderAlert = document.getElementById('reminderAlert');
        const alertMedName = document.getElementById('alertMedName');
        const alertDosage = document.getElementById('alertDosage');
        const alertNotes = document.getElementById('alertNotes');
        
        if (alertMedName) alertMedName.textContent = reminder.medication_name;
        if (alertDosage) alertDosage.textContent = reminder.dosage;
        if (alertNotes) alertNotes.textContent = reminder.notes || '';
        
        // Store current reminder for actions
        this.currentAlertReminder = reminder;
        
        const modal = new bootstrap.Modal(reminderAlert);
        modal.show();
    }
    
    markAsTaken(reminderId = null) {
        const reminder = reminderId || this.currentAlertReminder;
        if (!reminder) return;
        
        // Log as taken
        const todayKey = new Date().toDateString();
        const todayData = MediTranslate.loadFromLocalStorage(`medicationLog_${todayKey}`) || {};
        todayData[`${reminder.id}_${new Date().getTime()}`] = 'taken';
        MediTranslate.saveToLocalStorage(`medicationLog_${todayKey}`, todayData);
        
        MediTranslate.showNotification('Medication marked as taken', 'success');
        
        // Hide modal
        const reminderAlert = bootstrap.Modal.getInstance(document.getElementById('reminderAlert'));
        if (reminderAlert) reminderAlert.hide();
        
        this.updateStats();
    }
    
    markAsMissed(reminderId = null) {
        const reminder = reminderId || this.currentAlertReminder;
        if (!reminder) return;
        
        // Log as missed
        const todayKey = new Date().toDateString();
        const todayData = MediTranslate.loadFromLocalStorage(`medicationLog_${todayKey}`) || {};
        todayData[`${reminder.id}_${new Date().getTime()}`] = 'missed';
        MediTranslate.saveToLocalStorage(`medicationLog_${todayKey}`, todayData);
        
        MediTranslate.showNotification('Medication marked as missed', 'warning');
        
        this.updateStats();
    }
    
    snoozeReminder(reminderId = null) {
        const reminder = reminderId || this.currentAlertReminder;
        if (!reminder) return;
        
        // Set reminder for 15 minutes later
        setTimeout(() => {
            this.showReminderAlert(reminder);
        }, 15 * 60 * 1000); // 15 minutes
        
        MediTranslate.showNotification('Reminder snoozed for 15 minutes', 'info');
        
        // Hide current modal
        const reminderAlert = bootstrap.Modal.getInstance(document.getElementById('reminderAlert'));
        if (reminderAlert) reminderAlert.hide();
    }
    
    scrollToAddReminder() {
        const addReminder = document.querySelector('.add-reminder');
        if (addReminder) {
            addReminder.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    scrollToTodaySchedule() {
        const todaySchedule = document.querySelector('.todays-schedule');
        if (todaySchedule) {
            todaySchedule.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

// Global functions for button onclick handlers
function updateTimeSlots() {
    if (window.reminders) {
        window.reminders.updateTimeSlots();
    }
}

function deleteReminder(reminderId) {
    if (window.reminders) {
        window.reminders.deleteReminder(reminderId);
    }
}

function editReminder(reminderId) {
    if (window.reminders) {
        window.reminders.editReminder(reminderId);
    }
}

function saveEditedReminder() {
    if (window.reminders) {
        window.reminders.saveEditedReminder();
    }
}

function markAsTaken(reminderId) {
    if (window.reminders) {
        window.reminders.markAsTaken(reminderId);
    }
}

function markAsMissed(reminderId) {
    if (window.reminders) {
        window.reminders.markAsMissed(reminderId);
    }
}

function snoozeReminder(reminderId) {
    if (window.reminders) {
        window.reminders.snoozeReminder(reminderId);
    }
}

function scrollToAddReminder() {
    if (window.reminders) {
        window.reminders.scrollToAddReminder();
    }
}

// Initialize reminders when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.reminders = new MedicationReminders();
});
