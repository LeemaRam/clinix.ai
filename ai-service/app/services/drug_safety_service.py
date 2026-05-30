# ai-service/app/services/drug_safety_service.py
import os
import requests
from typing import List, Dict

# Keep using RxNorm only for normalization / RXCUI lookup
RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST'
RXNORM_API_ID = os.getenv('RXNORM_API_ID', '')
<<<<<<< HEAD

# OpenAI helper is in sibling module; use it for interaction analysis
from .ai_service import generate_json

=======
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280

def get_rxcui(drug_name: str) -> str | None:
    params = {'name': drug_name}
    if RXNORM_API_ID:
        params['apikey'] = RXNORM_API_ID
    try:
<<<<<<< HEAD
        r = requests.get(f'{RXNORM_BASE}/rxcui.json', params=params, timeout=5)
        print("RXNORM STATUS:", r.status_code)
        print("RXNORM URL:", r.url)
        print("RXNORM TEXT:", (r.text or '')[:1000])
        data = r.json()
        ids = data.get('idGroup', {}).get('rxnormId', [])
=======
        params = {'name': drug_name}
        if RXNORM_API_ID:
            params['apikey'] = RXNORM_API_ID
        r = requests.get(f'{RXNORM_BASE}/rxcui.json',
                         params=params, timeout=5)
        ids = r.json().get('idGroup', {}).get('rxnormId', [])
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
        return ids[0] if ids else None
    except Exception as exc:
        print(f"[DrugSafety] RXNORM lookup failed for {drug_name}: {exc}")
        return None


def check_interactions(new_drugs: List[str], existing_drugs: List[str]) -> Dict:
<<<<<<< HEAD
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
=======
    if not new_drugs or not existing_drugs:
        return {'warnings': [], 'safe': True}
    all_drugs = new_drugs + existing_drugs
    rxcuis = [c for d in all_drugs if (c := get_rxcui(d))]
    if len(rxcuis) < 2:
        return {'warnings': [], 'safe': True, 'note': 'Could not resolve drug IDs'}
    try:
        params = {'rxcuis': ' '.join(rxcuis)}
        if RXNORM_API_ID:
            params['apikey'] = RXNORM_API_ID
        r = requests.get(
            'https://rxnav.nlm.nih.gov/REST/interaction/list.json',
            params=params, timeout=8
        )
        data = r.json()
    except Exception as e:
        return {'warnings': [], 'safe': True, 'error': str(e)}
    warnings = []
    groups = data.get('fullInteractionTypeGroup', [])
    for group in groups:
        for itype in group.get('fullInteractionType', []):
            for pair in itype.get('interactionPair', []):
                desc = pair.get('description', '')
                severity = pair.get('severity', 'N/A')
                drugs_in = [c['minConcept'][0]['name']
                            for c in pair.get('interactionConcept', [])
                            if c.get('minConcept')]
                warnings.append({
                    'drugs': drugs_in,
                    'description': desc,
                    'severity': severity,
                    'color': 'red' if 'major' in severity.lower() else 'yellow'
                })
    return {'warnings': warnings, 'safe': len(warnings) == 0}
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
