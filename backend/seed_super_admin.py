import os
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

# Load environment variables
load_dotenv()

MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/mediscribe')
client = MongoClient(MONGODB_URI)
db = client.mediscribe

def seed_super_admin():
    """
    Crea un usuario super admin con credenciales predeterminadas.
    Todos los textos deben ser traducibles.
    """
    email = 'admin@email.com'
    password = 'admin'
    full_name = 'Super Admin'
    role = 'super_admin'
    language = 'es'
    phone = ''
    is_active = True
    now = datetime.utcnow()

    # Verifica si el usuario ya existe
    existing = db.users.find_one({'email': email})
    if existing:
        print(f"El usuario con email {email} ya existe.")
        return

    user_data = {
        'email': email,
        'password_hash': generate_password_hash(password),
        'full_name': full_name,
        'role': role,
        'is_active': is_active,
        'language': language,
        'phone': phone,
        'created_at': now,
        'updated_at': now
    }

    result = db.users.insert_one(user_data)
    print(f"Usuario super admin creado con email: {email} y id: {result.inserted_id}")

if __name__ == '__main__':
    seed_super_admin()
    print('Super admin seeding complete.') 