import os
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import stripe

# Load environment variables
load_dotenv()

STRIPE_API_KEY = os.environ.get('STRIPE_SECRET_KEY')
if not STRIPE_API_KEY:
    raise Exception('La clave STRIPE_API_KEY no está configurada.')
stripe.api_key = STRIPE_API_KEY

MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/clinix_ai')
client = MongoClient(MONGODB_URI)
db = client.clinix_ai

plans = [
    {
        'name': 'Trial',
        'description': 'Plan de Prueba: 10 transcripciones gratuitas. Acceso completo a todas las funcionalidades por 7 días.',
        'price': 0,
        'currency': 'USD',
        'interval': 'trial',
        'transcriptionsPerMonth': 10,
        'diskSpaceGB': 2,
        'features': [
            '10 Transcripciones Gratuitas',
            'Acceso Completo por 7 Días',
            'Soporte por Email',
            'Todas las Funcionalidades'
        ],
        'active': True,
        'popular': False,
        'trial_days': 30,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'deleted': False
    },
    {
        'name': 'Esencial',
        'description': 'Plan Esencial: 150 transcripciones al mes. Soporte prioritario por email.',
        'price': 39,
        'currency': 'USD',
        'interval': 'month',
        'transcriptionsPerMonth': 150,
        'diskSpaceGB': 10,
        'features': [
            '150 Transcripciones/Mes',
            'Soporte Prioritario por Email'
        ],
        'active': True,
        'popular': False,
        'trial_days': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'deleted': False
    },
    {
        'name': 'Esencial',
        'description': 'Plan Esencial: 150 transcripciones al mes. Soporte prioritario por email.',
        'price': 399,
        'currency': 'USD',
        'interval': 'year',
        'transcriptionsPerMonth': 150 * 12,
        'diskSpaceGB': 120,
        'features': [
            '150 Transcripciones/Mes',
            'Soporte Prioritario por Email'
        ],
        'active': True,
        'popular': False,
        'trial_days': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'deleted': False
    },
    {
        'name': 'Profesional',
        'description': 'Plan Profesional: 300 transcripciones al mes. Soporte prioritario por email y soporte telefónico.',
        'price': 59,
        'currency': 'USD',
        'interval': 'month',
        'transcriptionsPerMonth': 300,
        'diskSpaceGB': 20,
        'features': [
            '300 Transcripciones/Mes',
            'Soporte Prioritario por Email',
            'Soporte telefónico'
        ],
        'active': True,
        'popular': False,
        'trial_days': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'deleted': False
    },
    {
        'name': 'Profesional',
        'description': 'Plan Profesional: 300 transcripciones al mes. Soporte prioritario por email y soporte telefónico.',
        'price': 599,
        'currency': 'USD',
        'interval': 'year',
        'transcriptionsPerMonth': 300 * 12,
        'diskSpaceGB': 240,
        'features': [
            '300 Transcripciones/Mes',
            'Soporte Prioritario por Email',
            'Soporte telefónico'
        ],
        'active': True,
        'popular': False,
        'trial_days': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'deleted': False
    },
    {
        'name': 'Premium',
        'description': 'Plan Premium: 300 transcripciones al mes. Soporte prioritario por email, soporte telefónico y 1:1 soporte.',
        'price': 99,
        'currency': 'USD',
        'interval': 'month',
        'transcriptionsPerMonth': 300,
        'diskSpaceGB': 40,
        'features': [
            '300 Transcripciones/Mes',
            'Soporte Prioritario por Email',
            'Soporte telefónico',
            '1:1 Soporte'
        ],
        'active': True,
        'popular': True,
        'trial_days': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'deleted': False
    },
    {
        'name': 'Premium',
        'description': 'Plan Premium: 300 transcripciones al mes. Soporte prioritario por email, soporte telefónico y 1:1 soporte.',
        'price': 999,
        'currency': 'USD',
        'interval': 'year',
        'transcriptionsPerMonth': 300 * 12,
        'diskSpaceGB': 480,
        'features': [
            '300 Transcripciones/Mes',
            'Soporte Prioritario por Email',
            'Soporte telefónico',
            '1:1 Soporte'
        ],
        'active': True,
        'popular': True,
        'trial_days': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'deleted': False
    }
]

def create_stripe_product_and_price(plan):
    # Skip Stripe creation for trial plans
    if plan['interval'] == 'trial':
        return None, None
    
    # Check if product exists by name
    products = stripe.Product.search(query=f"name:'{plan['name']} {plan['interval'].capitalize()}'")
    if products.data:
        product = products.data[0]
    else:
        product = stripe.Product.create(
            name=f"{plan['name']} {plan['interval'].capitalize()}",
            description=plan['description'],
        )
    # Check if price exists for this product, interval, and amount
    prices = stripe.Price.list(
        product=product.id,
        active=True,
        limit=100
    )
    price_obj = None
    for p in prices.auto_paging_iter():
        if (
            p.unit_amount == int(plan['price'] * 100) and
            p.currency == plan['currency'].lower() and
            p.recurring and p.recurring['interval'] == plan['interval']
        ):
            price_obj = p
            break
    if not price_obj:
        price_obj = stripe.Price.create(
            unit_amount=int(plan['price'] * 100),
            currency=plan['currency'].lower(),
            recurring={"interval": plan['interval']},
            product=product.id,
        )
    return product.id, price_obj.id

def seed_subscription_plans():
    collection = db.subscription_plans
    # Remove all existing plans
    collection.delete_many({})
    for plan in plans:
        # Create Stripe product and price (skip for trial plans)
        try:
            if plan['interval'] == 'trial':
                plan['stripeProductId'] = None
                plan['stripePriceId'] = None
                collection.insert_one(plan)
                print(f"Plan de prueba insertado: {plan['name']} | Sin Stripe (plan gratuito)")
            else:
                product_id, price_id = create_stripe_product_and_price(plan)
                plan['stripeProductId'] = product_id
                plan['stripePriceId'] = price_id
                collection.insert_one(plan)
                print(f"Plan insertado: {plan['name']} ({plan['interval']}) | Stripe Product: {product_id} | Stripe Price: {price_id}")
        except Exception as e:
            print(f"Error al crear el plan en Stripe: {plan['name']} ({plan['interval']}): {str(e)}")

if __name__ == '__main__':
    seed_subscription_plans()
    print('Subscription plans seeding complete.') 