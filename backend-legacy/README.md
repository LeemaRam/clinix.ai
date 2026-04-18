# Clinix.ai Flask Backend

A complete Flask backend for the Clinix.ai medical transcription application with MongoDB integration.

## Features

- **Authentication**: JWT-based authentication with user registration and login
- **Patient Management**: CRUD operations for patient records
- **Consultation Management**: Handle medical consultations with audio recording
- **Audio Transcription**: Integration with OpenAI Whisper for speech-to-text
- **Report Generation**: Generate medical reports in SOAP, Comprehensive, and Brief formats
- **Real-time Updates**: WebSocket support for live updates
- **File Upload**: Secure audio file upload and storage
- **PDF Generation**: Export reports as PDF documents
- **Dashboard Statistics**: Analytics and reporting for doctors

## Installation

1. **Clone and setup**:
```bash
cd flask-backend
pip install -r requirements.txt
```

2. **Environment Setup**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **MongoDB Setup**:
Make sure MongoDB is running locally or update the `MONGODB_URI` in your `.env` file.

4. **Create Upload Directories**:
```bash
mkdir -p uploads/audio uploads/reports
```

## Configuration

Update the `.env` file with your settings:

```env
# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your-super-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/clinix_ai

# OpenAI Configuration (for transcription)
OPENAI_API_KEY=your-openai-api-key-here

# Email Configuration (optional)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

## Running the Application

### Development Mode
```bash
python app.py
```

### Production Mode
```bash
python run.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user info

### Patients
- `GET /api/patients` - List patients
- `POST /api/patients` - Create patient
- `GET /api/patients/<id>` - Get patient details
- `PUT /api/patients/<id>` - Update patient

### Consultations
- `POST /api/consultations` - Create consultation
- `POST /api/consultations/<id>/start` - Start consultation
- `POST /api/consultations/<id>/end` - End consultation
- `POST /api/consultations/<id>/upload-audio` - Upload audio file

### Transcriptions
- `GET /api/transcriptions` - List transcriptions
- `GET /api/transcriptions/<id>` - Get transcription details
- `PUT /api/transcriptions/<id>/edit` - Edit transcription

### Reports
- `POST /api/reports/generate` - Generate medical report
- `GET /api/reports` - List reports
- `GET /api/reports/<id>` - Get report details
- `GET /api/reports/<id>/pdf` - Download report as PDF

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

## Database Collections

The application uses the following MongoDB collections:

- **users**: User accounts and authentication
- **patients**: Patient records and medical history
- **consultations**: Medical consultations and recordings
- **transcriptions**: Audio transcription results
- **reports**: Generated medical reports
- **settings**: User preferences and configuration

## Features

### Audio Transcription
- Supports multiple audio formats (WAV, MP3, M4A, FLAC, OGG)
- Integration with OpenAI Whisper API
- Speaker differentiation (doctor, patient, third party)
- Medical terminology recognition
- Real-time transcription status updates

### Report Generation
- **SOAP Format**: Subjective, Objective, Assessment, Plan
- **Comprehensive Format**: Detailed medical report
- **Brief Format**: Concise summary
- PDF export functionality
- Compliance with Mexican regulation NOM-004-SSA3-2012

### Real-time Features
- WebSocket support for live updates
- Real-time transcription progress
- Instant notification of completed processes

### Security
- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on sensitive endpoints
- File upload validation
- CORS configuration

## Development

### Adding New Features
All functionality is contained in the main `app.py` file for simplicity. To add new features:

1. Add new route functions
2. Update database operations as needed
3. Add any new utility functions
4. Update this README

### Testing
```bash
# Install test dependencies
pip install pytest pytest-flask

# Run tests (when implemented)
pytest
```

## Deployment

### Docker (Recommended)
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["python", "run.py"]
```

### Traditional Deployment
1. Install dependencies on server
2. Configure environment variables
3. Set up MongoDB
4. Configure reverse proxy (nginx)
5. Use process manager (PM2, systemd)

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**:
   - Ensure MongoDB is running
   - Check connection string in `.env`

2. **OpenAI API Error**:
   - Verify API key is set correctly
   - Check API quota and billing

3. **File Upload Issues**:
   - Ensure upload directories exist
   - Check file permissions
   - Verify file size limits

4. **CORS Issues**:
   - Update `CORS_ORIGINS` in `.env`
   - Check frontend URL configuration

## License

This project is licensed under the MIT License.