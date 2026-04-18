# ai-service/app/services/drug_safety_service.py
import requests
from typing import List, Dict

RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST'

def get_rxcui(drug_name: str) -> str | None:
    try:
        r = requests.get(f'{RXNORM_BASE}/rxcui.json',
                         params={'name': drug_name}, timeout=5)
        ids = r.json().get('idGroup', {}).get('rxnormId', [])
        return ids[0] if ids else None
    except Exception:
        return None

def check_interactions(new_drugs: List[str], existing_drugs: List[str]) -> Dict:
    if not new_drugs or not existing_drugs:
        return {'warnings': [], 'safe': True}
    all_drugs = new_drugs + existing_drugs
    rxcuis = [c for d in all_drugs if (c := get_rxcui(d))]
    if len(rxcuis) < 2:
        return {'warnings': [], 'safe': True, 'note': 'Could not resolve drug IDs'}
    try:
        r = requests.get(
            'https://rxnav.nlm.nih.gov/REST/interaction/list.json',
            params={'rxcuis': ' '.join(rxcuis)}, timeout=8
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