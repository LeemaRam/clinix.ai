#!/usr/bin/env python3
"""
Quick test script to verify OpenAI API key is working
"""
import os
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_openai_connection():
    """Test OpenAI API connection"""
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        print(f"API Key found: {bool(api_key)}")
        
        if api_key:
            print(f"API Key format: {api_key[:7]}...{api_key[-4:]}")
            print(f"Key type: {'Project key' if api_key.startswith('sk-proj-') else 'User key' if api_key.startswith('sk-') else 'Unknown'}")
        
        # Initialize client
        client = OpenAI(api_key=api_key)
        
        # Test with a simple completion
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=10
        )
        
        print("✅ OpenAI API connection successful!")
        print(f"Response: {response.choices[0].message.content}")
        return True
        
    except Exception as e:
        print(f"❌ OpenAI API connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    test_openai_connection()