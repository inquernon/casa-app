# Genera supabase/migrations/0004 (parte de datos) a partir del menú ajustado v4.
# Cantidades por persona en la unidad base del artículo (g, ml o unidad). Todas aprox.
import json

# clave: (nombres candidatos en el catálogo, grupo, unidad)
ITEMS = {
 'arroz': (['Arroz'], 'Harina', 'g'),
 'arepa': (['Arepas delgadas'], 'Harina', 'unidad'),
 'tostadas': (['Tostadas integrales'], 'Harina', 'unidad'),        # unidad = paquete
 'saltinas': (['Tostadas o galletas saltinas'], 'Harina', 'unidad'),  # unidad = paquete
 'pan': (['Pan tajado'], 'Harina', 'unidad'),                       # unidad = paquete
 'avena': (['Avena en hojuelas'], 'Harina', 'g'),
 'pasta': (['Pasta'], 'Harina', 'g'),
 'papa': (['Papa común'], 'Harina', 'g'),
 'criolla': (['Papa criolla'], 'Harina', 'g'),
 'yuca': (['Yuca'], 'Harina', 'g'),
 'maduro': (['Plátano maduro'], 'Harina', 'unidad'),
 'verde': (['Plátano verde'], 'Verdura', 'unidad'),
 'mazorca': (['Mazorca'], 'Verdura', 'unidad'),
 'leguminosa': (['Fríjol, lenteja o garbanzo secos'], 'Harina', 'g'),
 'huevo': (['Huevos'], 'Sustituto', 'unidad'),
 'queso': (['Queso campesino, quesito o mozzarella'], 'Sustituto', 'g'),
 'jamon': (['Jamón de pavo o pollo'], 'Sustituto', 'g'),
 'leche': (['Leche UHT'], 'Lácteo', 'ml'),
 'kumis': (['Kumis'], 'Lácteo', 'unidad'),                         # unidad = bolsa de 1 L
 'mantequilla': (['Mantequilla'], 'Grasa', 'g'),
 'aguacate': (['Aguacate'], 'Grasa', 'unidad'),
 'mani': (['Maní sin sal u otros frutos secos', 'Frutos secos'], 'Grasa', 'g'),
 'mmani': (['Mantequilla de maní'], 'Despensa', 'unidad'),          # unidad = tarro
 'panela': (['Panela'], 'Despensa', 'unidad'),
 'garbanzo_t': (['Garbanzos tostados'], 'Sustituto', 'g'),
 'molida': (['Carne molida de res'], 'Proteína', 'g'),
 'osobuco': (['Osobuco'], 'Proteína', 'g'),
 'pechuga': (['Pechuga o contramuslo de pollo sin hueso'], 'Proteína', 'g'),
 'contramuslo': (['Contramuslo de pollo con hueso'], 'Proteína', 'g'),
 'espinazo': (['Espinazo de res'], 'Proteína', 'g'),
 'pescado': (['Filete de pescado blanco'], 'Proteína', 'g'),
 'zanahoria': (['Zanahoria'], 'Verdura', 'g'),
 'repollo': (['Repollo'], 'Verdura', 'g'),
 'pepino': (['Pepino'], 'Verdura', 'unidad'),
 'cebolla': (['Cebolla (cabezona o junca)'], 'Verdura', 'g'),
 'pimenton': (['Pimentón'], 'Verdura', 'unidad'),
 'champi': (['Champiñones'], 'Verdura', 'g'),
 'espinaca': (['Espinaca'], 'Verdura', 'g'),
 'brocoli': (['Brócoli'], 'Verdura', 'g'),
 'apio': (['Apio'], 'Verdura', 'g'),
 'tomate': (['Tomate'], 'Verdura', 'g'),
 'banano': (['Banano'], 'Fruta', 'unidad'),
 'manzana': (['Manzana'], 'Fruta', 'unidad'),
 'pera': (['Pera'], 'Fruta', 'unidad'),
 'mango': (['Mango'], 'Fruta', 'unidad'),
 'papaya': (['Papaya'], 'Fruta', 'unidad'),
 'pina': (['Piña'], 'Fruta', 'unidad'),
 'naranja': (['Naranja'], 'Fruta', 'unidad'),
}

# Porciones por persona (Mariana, Alex). Fuente: intercambios del plan; equivalencias en peso aprox.
P = {
 'arroz': (35, 35),          # 6 cdas cocido ≈ 95 g ≈ 35 g crudo
 'arepa': (1, 1),
 'tostadas': (0.1, 0.1),     # 2 tostadas ≈ 1/10 de paquete
 'saltinas': (0.08, 0.08),   # 3 galletas
 'pan': (0.1, 0.1),          # 2 tajadas
 'avena': (40, 40),
 'pasta': (55, 55),
 'papa': (150, 150),
 'papa_sopa': (80, 80),
 'criolla': (90, 90),
 'yuca': (120, 120),
 'maduro': (0.25, 0.25),
 'verde': (0.5, 0.5),
 'mazorca': (0.5, 0.5),
 'leguminosa': (40, 40),     # 1 cucharón cocido ≈ 40 g seco
 'huevo': (1, 1),
 'queso': (30, 30),
 'jamon': (40, 40),
 'leche': (200, 200),
 'kumis': (0.2, 0.2),
 'mantequilla': (5, 5),
 'aguacate': (0.25, 0.25),
 'mani': (15, 15),
 'mmani': (0.05, 0.05),
 'panela': (0.1, 0.1),
 'garbanzo_t': (15, 15),
 'molida': (120, 140), 'osobuco': (257, 300), 'pechuga': (120, 140), 'contramuslo': (184, 214),
 'espinazo': (129, 150), 'pollo_sancocho': (92, 107), 'pescado': (112, 131),
 'zanahoria': (50, 50), 'repollo': (50, 50), 'pepino': (0.25, 0.25), 'cebolla': (20, 20),
 'pimenton': (0.15, 0.15), 'champi': (60, 60), 'espinaca': (60, 60), 'brocoli': (80, 80),
 'apio': (20, 20), 'tomate_m': (60, 0), 'tomate_licuado': (50, 50),
 'banano': (1, 1), 'manzana': (1, 1), 'pera': (1, 1), 'mango': (1, 1), 'papaya': (0.125, 0.125),
 'pina': (0.1, 0.1), 'naranja': (1, 0),
}

def I(key, item=None, m=None, a=None):
    item = item or key
    pm, pa = P[key]
    return (item, pm if m is None else m, pa if a is None else a)

ENS = [I('repollo'), I('zanahoria'), I('pepino')]
R = {}  # nombre -> (comida, minutos, pasos, ingredientes)
def rec(name, meal, minutes, steps, ings):
    R[name] = (meal, minutes, steps, ings)
    return name

# --- Desayunos
dH1 = rec('Tostadas con aguacate y huevo revuelto', 'desayuno', 10, 'Huevo revuelto sin aceite extra. Aguapanela con leche.',
          [I('tostadas'), I('aguacate'), I('huevo'), I('leche'), I('panela'), I('pera')])
dQ1 = rec('Arepa con quesito', 'desayuno', 8, 'Arepa asada. Aguapanela con leche. Mariana: naranja; Alex: papaya.',
          [I('arepa'), I('queso'), I('leche'), I('panela'), I('naranja', 'naranja', 1, 0), I('papaya', 'papaya', 0, 0.125)])
dH2 = rec('Arepa con huevo revuelto', 'desayuno', 10, 'Huevo revuelto con cebolla. Mariana: pericos con tomate.',
          [I('arepa'), I('huevo'), I('cebolla', m=10, a=10), I('leche'), I('panela'), I('naranja', 'naranja', 1, 0), I('papaya', 'papaya', 0, 0.125)])
dQ2 = rec('Tostadas con aguacate y quesito', 'desayuno', 5, 'Leche con canela (Mariana: café con leche).',
          [I('tostadas'), I('aguacate'), I('queso'), I('leche'), I('pera')])
dQ3 = rec('Arepa con quesito y banano', 'desayuno', 8, 'Aguapanela con leche.',
          [I('arepa'), I('queso'), I('leche'), I('panela'), I('banano')])
dA1 = rec('Avena en leche con manzana', 'desayuno', 8, 'Leche y avena a fuego bajo con canela; se puede dejar remojando la noche anterior. Mariana: + huevo duro.',
          [I('avena'), I('leche'), I('manzana'), I('huevo', 'huevo', 1, 0)])
dA2 = rec('Batido de avena y banano con mantequilla de maní', 'desayuno', 3, 'Licuar leche, avena, banano y canela. Mariana: + huevo duro.',
          [I('avena'), I('leche'), I('banano'), I('mmani'), I('huevo', 'huevo', 1, 0)])
dA3 = rec('Kumis con avena y mango', 'desayuno', 3, 'Mariana: + huevo duro.',
          [I('kumis'), I('avena'), I('mango'), I('huevo', 'huevo', 1, 0)])
dA4 = rec('Avena en leche con banano y maní', 'desayuno', 8, 'Mariana: + huevo revuelto.',
          [I('avena'), I('leche'), I('banano'), I('mani'), I('huevo', 'huevo', 1, 0)])
dA5 = rec('Kumis con avena y manzana', 'desayuno', 3, 'Mariana: + huevo duro.',
          [I('kumis'), I('avena'), I('manzana'), I('huevo', 'huevo', 1, 0)])
dA6 = rec('Avena en leche con manzana y maní', 'desayuno', 8, 'Mariana: + huevo duro.',
          [I('avena'), I('leche'), I('manzana'), I('mani'), I('huevo', 'huevo', 1, 0)])
dA7 = rec('Avena en leche con papaya', 'desayuno', 8, 'Con canela. Mariana: + huevo revuelto.',
          [I('avena'), I('leche'), I('papaya'), I('huevo', 'huevo', 1, 0)])
dH3 = rec('Arepa con huevo revuelto y papaya', 'desayuno', 10, 'Aguapanela con leche. Mariana: naranja.',
          [I('arepa'), I('huevo'), I('leche'), I('panela'), I('naranja', 'naranja', 1, 0), I('papaya', 'papaya', 0, 0.125)])

# --- Media mañana
mm = {k: rec(n, 'media_manana', 1, '', [I(k)]) for k, n in [('pina', 'Piña'), ('pera', 'Pera'), ('mango', 'Mango'), ('papaya', 'Papaya'), ('banano', 'Banano'), ('manzana', 'Fruta de la semana')]}
mmS = rec('Saltinas con leche', 'media_manana', 2, 'Mariana: café con leche si quiere.', [I('saltinas'), I('leche', m=150, a=150)])
mmG = rec('Manzana y garbanzos tostados', 'media_manana', 1, '', [I('manzana'), I('garbanzo_t')])

# --- Almuerzos
SOF = 'Usar 2 cubos de sofrito base. '
aL1 = rec('Carne molida guisada, maduro y sopa de papa', 'almuerzo', 35, SOF + 'Carne 5 min en el sofrito. Maduro en freidora 180 °C 15 min. Sopa con papa y zanahoria.',
          [I('molida'), I('arroz'), I('maduro'), I('papa_sopa', 'papa'), I('zanahoria', m=30, a=30)] + ENS)
aM1 = rec('Lentejas con carne molida', 'almuerzo', 30, SOF + 'Lentejas 8 min a presión (o porción congelada).',
          [I('leguminosa'), I('molida'), I('arroz'), I('aguacate'), I('repollo'), I('zanahoria')])
aOso = rec('Osobuco con puré de yuca y mazorca', 'almuerzo', 45, SOF + 'Osobuco 35 min a presión y 8 min en freidora. Yuca 10 min a presión, machacar con mantequilla y leche.',
           [I('osobuco'), I('yuca'), I('mantequilla'), I('leche', m=30, a=30), I('arroz'), I('mazorca'), I('zanahoria')])
aJ1 = rec('Pollo desmechado sofrito con papas y pimentón', 'almuerzo', 35, SOF + 'Pechuga 15 min a presión, desmechar y sofreír con cebolla. Papas en cubos con pimentón en freidora 18 min.',
          [I('pechuga'), I('arroz'), I('papa', m=100, a=100), I('pimenton'), I('maduro'), I('cebolla')] + ENS)
aV1 = rec('Fríjol rojo con carne molida', 'almuerzo', 30, SOF + 'Fríjol remojado, 25–30 min a presión (o porción congelada).',
          [I('leguminosa'), I('molida'), I('arroz'), I('maduro'), I('aguacate'), I('mango', m=0.5, a=0.5), I('zanahoria')])
aS1 = rec('Pasta boloñesa suave', 'almuerzo', 30, 'Carne molida guisada + tomate y zanahoria licuados, 15 min tapado.',
          [I('pasta'), I('molida'), I('tomate_licuado', 'tomate'), I('zanahoria', m=80, a=80)] + ENS)
aSan = rec('Sancocho de espinazo y pollo', 'almuerzo', 50, 'Espinazo 25 min a presión; agregar pollo, yuca, papa y mazorca, 10 min más. Cocinar doble el domingo de la semana 1.',
           [I('espinazo'), I('pollo_sancocho', 'contramuslo'), I('yuca', m=80, a=80), I('papa', m=100, a=100), I('mazorca'), I('aguacate')])
aSan2 = rec('Sancocho de espinazo y pollo (doble, para el lunes)', 'almuerzo', 55, 'Igual que el sancocho, con el doble de todo. La mitad se guarda para el almuerzo del lunes.',
            [(k, m*2, a*2) for k, m, a in R[aSan][3]])
aSanS = rec('Sancocho del domingo', 'almuerzo', 10, 'Calentar el sancocho guardado. Ya se descontó el domingo.',
            [I('arroz', m=20, a=20)] + ENS)
aMa2 = rec('Contramuslo en freidora con crema de espinaca', 'almuerzo', 30, 'Contramuslo sin piel adobado, 180 °C 22–25 min. Crema preparada la noche anterior.',
           [I('contramuslo'), I('arroz'), I('maduro'), I('espinaca'), I('papa', m=40, a=40)] + ENS)
aJ2 = rec('Garbanzos guisados con carne molida', 'almuerzo', 35, SOF + 'Garbanzo remojado, 30–35 min a presión (o porción congelada).',
          [I('leguminosa'), I('molida'), I('arroz'), I('maduro'), I('repollo'), I('zanahoria')])
aV2 = rec('Pescado apanado en freidora con patacón', 'almuerzo', 25, 'Filete con huevo y avena molida, 200 °C 10–12 min. Patacón en freidora.',
          [I('pescado'), I('huevo', m=0.5, a=0.5), I('avena', m=10, a=10), I('arroz'), I('verde'), I('aguacate')] + ENS)
aS2 = rec('Pasta con champiñones y pollo', 'almuerzo', 30, 'Pollo en cubos sofrito con champiñones y un chorrito de leche.',
          [I('pasta'), I('pechuga'), I('champi'), I('leche', m=30, a=30), I('zanahoria', m=80, a=80)] + ENS)

# --- Cenas
cL1 = rec('Arepa con champiñones a la mantequilla y papa criolla', 'cena', 20, 'Champiñones salteados en mantequilla. Criolla en freidora 18 min. Mariana: + tomate.',
          [I('arepa'), I('champi', m=80, a=80), I('mantequilla'), I('criolla'), I('mango', m=0.5, a=0.5), I('zanahoria', m=30, a=30), I('tomate_m', 'tomate')])
cTort = rec('Tortilla de verduras al horno con arepa', 'cena', 20, '3 huevos para los dos con espinaca, champiñón y pimentón, 180 °C 15 min.',
            [I('huevo', m=1.5, a=1.5), I('espinaca', m=30, a=30), I('champi', m=30, a=30), I('pimenton'), I('arepa'), I('brocoli')])
cCrema = rec('Crema de espinaca con sánduche de queso', 'cena', 20, 'Crema en caldo del osobuco; rinde para 2 días. Mariana: + tomate.',
             [I('espinaca'), I('papa', m=40, a=40), I('zanahoria', m=30, a=30), I('leche', m=50, a=50), I('pan'), I('queso'), I('tomate_m', 'tomate')])
cJam = rec('Sánduche de jamón de pavo y queso con papas', 'cena', 20, 'Papas en freidora 18 min. Máximo 1 vez por semana.',
           [I('pan'), I('jamon'), I('queso'), I('papa', m=100, a=100), I('mango'), I('tomate_m', 'tomate')])
cCremaV = rec('Crema de verduras con tostadas y aguacate', 'cena', 20, 'Zanahoria, espinaca y apio en caldo; licuar con leche.',
              [I('zanahoria', m=60, a=60), I('espinaca', m=30, a=30), I('apio'), I('papa', m=40, a=40), I('leche', m=50, a=50), I('tostadas'), I('aguacate')] + ENS)
cAQ = rec('Arepa rellena de quesito con ensalada', 'cena', 15, 'Ensalada de pepino y zanahoria.',
          [I('arepa'), I('queso'), I('pepino'), I('zanahoria'), I('manzana')])
cRev = rec('Huevos revueltos con espinaca y arepa', 'cena', 15, '2 huevos para los dos. Se adelanta la proteína del día siguiente.',
           [I('huevo'), I('espinaca', m=30, a=30), I('arepa')] + ENS)
cTP = rec('Tortilla de papa y huevo al horno', 'cena', 30, '3 huevos para los dos, papa en láminas, 180 °C 20 min. Mariana: + tomate.',
          [I('huevo', m=1.5, a=1.5), I('papa', m=100, a=100), I('cebolla'), I('mango', m=0.5, a=0.5), I('tomate_m', 'tomate')])
cTC = rec('Tortilla de champiñones al horno con arepa', 'cena', 20, '3 huevos para los dos.',
          [I('huevo', m=1.5, a=1.5), I('champi'), I('arepa')] + ENS)
cCremaV2 = rec('Crema de verduras con sánduche de queso', 'cena', 20, 'Zanahoria, espinaca y apio en caldo; licuar con leche.',
               [I('zanahoria', m=60, a=60), I('espinaca', m=30, a=30), I('apio'), I('papa', m=40, a=40), I('leche', m=50, a=50), I('pan'), I('queso')])
cCremaE = rec('Crema de espinaca con tostadas y aguacate', 'cena', 20, 'Licuar con leche.',
              [I('espinaca'), I('papa', m=40, a=40), I('leche', m=50, a=50), I('tostadas'), I('aguacate')] + ENS)
cAQ2 = rec('Arepa con quesito y ensalada', 'cena', 10, '',
           [I('arepa'), I('queso'), I('manzana')] + ENS)
cRevC = rec('Huevos revueltos con champiñones y arepa', 'cena', 15, '2 huevos para los dos.',
            [I('huevo'), I('champi', m=40, a=40), I('arepa')] + ENS)

# Sofrito: tanda que no está en el ciclo
rec('Sofrito base (tanda para 15 días)', 'tanda', 25, 'Licuar cebolla, pimentón, ajo y cilantro con 2 cdas de aceite. Sofreír 10 min y congelar en cubetas.',
    [I('cebolla', m=300, a=0), I('pimenton', m=2, a=0)])

PLAN = {
 1: (dH1, mm['pina'], aL1, cL1),
 2: (dA1, mmS, aM1, cTort),
 3: (dQ1, mm['pera'], aOso, cCrema),
 4: (dA2, mm['mango'], aJ1, cJam),
 5: (dA3, mmG, aV1, cCremaV),
 6: (dH1, mm['manzana'], aS1, cAQ),
 7: (dA4, mm['papaya'], aSan2, cRev),
 8: (dQ3, mmS, aSanS, cTP),
 9: (dA5, mm['pera'], aMa2, cTC),
 10: (dH3, mm['pera'], aOso, cCremaV2),
 11: (dA6, mmS, aJ2, cJam),
 12: (dA2, mmG, aV2, cCremaE),
 13: (dQ2, mm['manzana'], aS2, cAQ2),
 14: (dA7, mm['papaya'], aSan, cRevC),
}
MEALS = ['desayuno', 'media_manana', 'almuerzo', 'cena']

def q(s): return "'" + s.replace("'", "''") + "'"
rows = []
for name, (meal, minutes, steps, ings) in R.items():
    js = [{'key': k, 'names': ITEMS[k][0], 'grp': ITEMS[k][1], 'unit': ITEMS[k][2], 'm': m, 'a': a} for k, m, a in ings]
    rows.append(f"  ({q(name)}, {q(meal)}, {minutes}, {q(steps)}, {q(json.dumps(js, ensure_ascii=False))}::jsonb)")
plan = [f"  ({d}, {q(MEALS[i])}, {q(r)})" for d, rs in PLAN.items() for i, r in enumerate(rs)]
out = "insert into public.recipe_defaults (name, meal, minutes, steps, ingredients) values\n" + ",\n".join(rows) + "\non conflict (name) do update set meal = excluded.meal, minutes = excluded.minutes, steps = excluded.steps, ingredients = excluded.ingredients;\n\n"
out += "insert into public.menu_defaults (day, meal, recipe_name) values\n" + ",\n".join(plan) + "\non conflict (day, meal) do update set recipe_name = excluded.recipe_name;\n"
open('menu_seed.sql', 'w').write(out)
print(len(R), 'recetas,', len(plan), 'entradas de menú')
# Comprobación: huevos y queso por ciclo (para los dos)
tot = {}
for d, rs in PLAN.items():
    for r in rs:
        for k, m, a in R[r][3]:
            tot[k] = tot.get(k, 0) + m + a
for k in ['huevo', 'queso', 'avena', 'molida', 'osobuco', 'pechuga', 'contramuslo', 'espinazo', 'pescado', 'banano', 'leche']:
    print(k, round(tot.get(k, 0), 1), 'por ciclo ->', round(tot.get(k, 0) * 30 / 14, 1), 'por mes')
