# HealthCompanion
# 🏥 HealthCompanion – Smart Healthcare Web App for Rural India

HealthCompanion is a web-based healthcare platform designed to improve medical accessibility in rural India. The app includes features like AI-powered translation, a healthcare chatbot, OCR-based prescription handling, and automated reminders — all built to run on minimal resources and low bandwidth.

## ✨ Key Features

- 🌐 **Multilingual Translation** 
  Translate English medical text to Indian regional languages using AI/ML-based translation services.

- 💬 **AI Chatbot (Basic)**  
  A rule/logic-based chatbot for answering basic medical and health-related queries in local languages.

- 📄 **Prescription OCR**  
  Upload images of handwritten prescriptions and extract text using AI (Google Vision / AWS Textract).

- ⏰ **Health Reminders**  
  Generate medication and appointment reminders from digitized prescriptions or user input.

- 📶 **Rural Optimization**  
  Designed to work in areas with low internet connectivity and minimal tech literacy.

---

## 🔧 Tech Stack

### Frontend
- HTML5  
- CSS3  
- JavaScript

### Backend
- Flask (Python)  
- OCR using Google Vision / AWS Textract  
- Translation APIs (IndicTrans / AI4Bharat or similar)  
- SQLite (via SQLAlchemy ORM)
