# ai-service/app/services/drug_safety_service.py
import os
import requests
from typing import List, Dict

# Keep using RxNorm only for normalization / RXCUI lookup
RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST'
RXNORM_API_ID = os.getenv('RXNORM_API_ID', '')

# OpenAI helper is in sibling module; use it for interaction analysis
from .ai_service import generate_json


def get_rxcui(drug_name: str) -> str | None:
    params = {'name': drug_name}
    if RXNORM_API_ID:
        params['apikey'] = RXNORM_API_ID
    try:
        r = requests.get(f'{RXNORM_BASE}/rxcui.json', params=params, timeout=5)
        print("RXNORM STATUS:", r.status_code)
        print("RXNORM URL:", r.url)
        print("RXNORM TEXT:", (r.text or '')[:1000])
        data = r.json()
        ids = data.get('idGroup', {}).get('rxnormId', [])
        return ids[0] if ids else None
    except Exception as exc:
        print(f"[DrugSafety] RXNORM lookup failed for {drug_name}: {exc}")
        return None


def check_interactions(new_drugs: List[str], existing_drugs: List[str]) -> Dict:
    """
    Normalizes medication names via RxNorm (RXCUI lookup) and delegates
    interaction/warning/recommendation generation to OpenAI (via generate_json).
    """
    all_drugs = [d for d in (new_drugs or []) + (existing_drugs or []) if d]
    print('[DrugSafety] Medications Extracted:', all_drugs)

    # If not enough drugs to analyze interactions, return safe empty result
    if len(all_drugs) < 2:
        print('[DrugSafety] Not enough drugs to check for interactions')
        return {'warnings': [], 'interactions': [], 'recommendations': [], 'riskLevel': 'Low', 'safe': True}

    # Resolve RXCUIs for normalization/validation
    resolved = {}
    for drug in all_drugs:
        rx = get_rxcui(drug)
        resolved[drug] = rx
    print('[DrugSafety] Resolved RXCUIs:', resolved)

    # Build prompt for OpenAI analysis
    prompt = f"""
You are a pharmaceutical safety assistant. Do NOT call external drug databases.
Use clinical reasoning to analyze medication safety.
Return STRICT JSON only with keys: warnings (array of strings), interactions (array of strings), recommendations (array of strings), riskLevel (one of Low|Moderate|High).

Medications: {', '.join(all_drugs)}
RXCUI map: {resolved}

Guidelines:
- Consider bleeding risk, QT prolongation, renal dosing, CYP-mediated interactions, additive effects.
- Use conservative clinical recommendations (eg. avoid NSAIDs with warfarin -> Monitor INR, avoid NSAIDs).
- When unsure, include a conservative recommendation for manual review.
""".strip()

    fallback = {
        'warnings': [],
        'interactions': [],
        'recommendations': ['Manual drug safety review recommended.'],
        'riskLevel': 'Moderate'
    }

    parsed = generate_json(prompt, fallback)

    warnings = parsed.get('warnings') if isinstance(parsed.get('warnings'), list) else fallback['warnings']
    interactions = parsed.get('interactions') if isinstance(parsed.get('interactions'), list) else fallback['interactions']
    recommendations = parsed.get('recommendations') if isinstance(parsed.get('recommendations'), list) else fallback['recommendations']
    riskLevel = parsed.get('riskLevel') or fallback['riskLevel']

    # Logging for verification
    print('[DrugSafety] Warnings:', warnings)
    print('[DrugSafety] Interactions:', interactions)
    print('[DrugSafety] Recommendations:', recommendations)
    print('[DrugSafety] Risk Level:', riskLevel)

    safe = not bool(warnings)
    return {
        'warnings': warnings,
        'interactions': interactions,
        'recommendations': recommendations,
        'riskLevel': riskLevel,
        'safe': safe,
        'rxNorm': resolved
    }
