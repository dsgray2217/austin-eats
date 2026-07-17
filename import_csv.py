import json, csv, re

def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

data = json.load(open('data.json', encoding='utf-8-sig'))
max_id = max(r['id'] for r in data)
existing = {norm(r['name']): True for r in data}

# Manual skip list: CSV names that differ slightly but already exist in data.json
SKIP = {
    norm("Jeffrey's"),           # exists as Jeffery's
    norm("Emmer & Rye"),         # exists as Emmer and Rye
    norm("Cockti Juicy Fried Chicken"),  # exists as Cockti Juicy Chicken
    norm("Uptown"),              # exists as Uptown Sports Club
    norm("Comedor"),             # exists as Comedor Austin
    norm("Foreign & Domestic"),  # exists as Foreign and Domestic
    norm("Intero Restaurant"),   # exists as Intero
    norm("Nixta Taqueria"),      # exists as Nixta
    norm("Paprika ATX"),         # exists as Paprika
    norm("Komé: Sushi Kitchen"), # exists as Kome
    norm("Veracruz Fonda & Bar"),# exists as Veracruz Fonda
    norm("Qi Austin"),           # exists as Qi
    norm("Justine's Brasserie"), # exists as Justine's
    norm("Sour Duck Market"),    # exists as Sour Duck
}

NEIGH = {
    'south lamar': (30.2453, -97.7637),
    'east austin': (30.2627, -97.7193),
    'mueller': (30.2912, -97.7218),
    'south austin': (30.2232, -97.7665),
    'cherrywood': (30.2707, -97.7224),
    'mlk': (30.2831, -97.7244),
    'north austin': (30.3625, -97.7236),
    'clarksville': (30.2847, -97.7646),
    'brentwood': (30.3287, -97.7321),
    'quail creek': (30.3840, -97.7104),
    'downtown austin': (30.2670, -97.7431),
    'bouldin': (30.2380, -97.7597),
    'north lamar': (30.3200, -97.7388),
    'highland': (30.3297, -97.7075),
    'dawson': (30.2375, -97.7657),
    'hancock': (30.2978, -97.7350),
    'holly': (30.2530, -97.7195),
    'south congress': (30.2475, -97.7628),
    'govalle': (30.2640, -97.7042),
    'rainey street': (30.2570, -97.7389),
    'hyde park': (30.3060, -97.7397),
    'rosedale': (30.3168, -97.7459),
    'round rock': (30.5083, -97.6789),
    'cedar park': (30.5226, -97.8203),
    'anderson mill': (30.4600, -97.8049),
    'north shoal creek': (30.3542, -97.7445),
    'crestview': (30.3370, -97.7378),
    'the triangle': (30.3150, -97.7401),
    'east riverside': (30.2344, -97.7231),
    'west austin': (30.2900, -97.7800),
    'north loop': (30.3180, -97.7319),
    'west campus': (30.2862, -97.7484),
    'zilker': (30.2620, -97.7789),
    'windsor park': (30.3042, -97.7054),
    'east cesar chavez': (30.2589, -97.7132),
    'allandale': (30.3440, -97.7515),
    'garrison park': (30.2314, -97.7856),
    'heritage': (30.3267, -97.7218),
    'north university': (30.2982, -97.7388),
    'north burnet': (30.3780, -97.7178),
    'the arboretum': (30.3975, -97.7394),
    'the domain': (30.4025, -97.7272),
    'pflugerville': (30.4385, -97.6200),
    'dripping springs': (30.1900, -98.0866),
    'west lake hills': (30.2989, -97.8000),
    'travis heights': (30.2400, -97.7540),
    'barton hills': (30.2330, -97.7782),
    'central austin': (30.2950, -97.7500),
    'bryker woods': (30.2960, -97.7587),
    'del valle': (30.1889, -97.6772),
    'wells branch': (30.4364, -97.6892),
    'hill country': (30.3018, -98.1000),
}

EMOJI_MAP = [
    ('sushi', '🍣'), ('omakase', '🍣'), ('japanese', '🍣'),
    ('ramen', '🍜'), ('vietnamese', '🍜'), ('pho', '🍜'),
    ('taco', '🌮'), ('mexican', '🌮'), ('tex-mex', '🌮'),
    ('bbq', '🔥'), ('barbecue', '🔥'),
    ('pizza', '🍕'),
    ('italian', '🍝'), ('pasta', '🍝'),
    ('french', '🥐'),
    ('burger', '🍔'), ('american', '🍔'),
    ('sandwich', '🥪'), ('deli', '🥪'), ('bagel', '🥯'),
    ('steak', '🥩'), ('korean', '🥩'), ('kbbq', '🥩'), ('argentinian', '🥩'),
    ('chinese', '🥢'), ('dim sum', '🥢'), ('sichuan', '🥢'), ('hot pot', '🫕'),
    ('thai', '🌶'), ('lao', '🌶'), ('southeast asian', '🌶'),
    ('indian', '🍛'),
    ('seafood', '🦞'), ('cajun', '🦞'), ('raw bar', '🦪'),
    ('mediterranean', '🫒'), ('lebanese', '🫒'), ('middle eastern', '🫒'), ('israeli', '🫒'), ('persian', '🫒'),
    ('ethiopian', '🍲'), ('african', '🍲'), ('nigerian', '🍲'), ('georgian', '🫓'), ('jamaican', '🌴'), ('caribbean', '🌴'),
    ('peruvian', '🫙'), ('colombian', '🫙'),
    ('filipino', '🍲'), ('hawaiian', '🌺'),
    ('vegan', '🥗'),
    ('bar', '🍺'), ('brewery', '🍺'), ('wine', '🍷'),
    ('bakery', '🥐'), ('cafe', '☕'),
    ('fried chicken', '🍗'), ('southern', '🍗'),
    ('hot dog', '🌭'),
]

def get_emoji(cuisines_str, tags_str=''):
    combined = (cuisines_str + '|' + tags_str).lower()
    for kw, em in EMOJI_MAP:
        if kw in combined:
            return em
    return '🍽'

def get_latng(neighborhoods_str):
    if not neighborhoods_str:
        return (30.2672, -97.7431)
    for n in neighborhoods_str.lower().split('|'):
        n = n.strip()
        if n in NEIGH:
            return NEIGH[n]
        for k, v in NEIGH.items():
            if k in n or n in k:
                return v
    return (30.2672, -97.7431)

def get_price(price_str, tags_str, cuisines_str):
    if price_str and price_str.strip() and price_str.strip() != '$$$$':
        return price_str.strip()
    tags = (tags_str or '').lower()
    cuisines = (cuisines_str or '').lower()
    first = cuisines.split('|')[0].strip()
    if 'food-truck' in tags:
        return '$'
    if any(x in first for x in ['taco', 'mexican', 'tex-mex', 'hot dog', 'deli', 'bagel', 'pho', 'vietnamese']):
        return '$'
    return '$$'

def get_vibe(tags_str):
    t = (tags_str or '').lower()
    if 'date-night' in t:
        return 'Date Night'
    if 'bar' in t or 'late-night' in t:
        return 'Bar'
    return 'Casual'

rows = []
with open('c:/Users/DSG/Downloads/austin_eats_top200.csv', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        rows.append(row)

new_entries = []
skipped = []
next_id = max_id + 1

for row in rows:
    n = norm(row['name'])
    if n in existing or n in SKIP:
        skipped.append(row['name'])
        continue

    # Add to existing to prevent CSV-internal duplicates being double-added
    existing[n] = True

    cuisines = row.get('cuisines', '') or ''
    cuisine = cuisines.split('|')[0].strip() or 'Restaurant'
    neighborhoods = row.get('neighborhoods', '') or ''
    tags_raw = row.get('tags', '') or ''
    tags = [t.strip() for t in tags_raw.split('|') if t.strip()]
    score = row.get('score', '')
    quality = round(float(score)) if score else 0
    lat, lng = get_latng(neighborhoods)
    addr_base = neighborhoods.split('|')[0].strip()
    address = f"{addr_base}, Austin, TX" if addr_base else "Austin, TX"

    entry = {
        "id": next_id,
        "name": row['name'],
        "cuisine": cuisine,
        "emoji": get_emoji(cuisines, tags_raw),
        "address": address,
        "price": get_price(row.get('price',''), tags_raw, cuisines),
        "status": "saved",
        "rating": 0,
        "quality": quality,
        "vibe": get_vibe(tags_raw),
        "hours": "",
        "website": "",
        "resy": "",
        "tags": tags,
        "notes": "",
        "lat": lat,
        "lng": lng,
        "photo": "",
        "opentable": "",
        "lastVisited": "",
        "googlePlaceId": ""
    }
    new_entries.append(entry)
    next_id += 1

data.extend(new_entries)
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Added {len(new_entries)} new restaurants. Skipped {len(skipped)} already tracked.")
print(f"Total restaurants: {len(data)}")
print("\nSkipped (already in site):")
for s in skipped:
    print(f"  {s}")
print("\nAdded:")
for e in new_entries:
    print(f"  {e['name']} ({e['cuisine']}, {e['address']})")
