"""
INSTRUCCIONES:
1. Copiá este archivo dentro de la carpeta 'historico'
2. Doble clic en el archivo (o clic derecho → Abrir con → Python)
3. Listo — modifica todos los index.html automáticamente

Requisitos: Python instalado (https://python.org)
"""

import os

# Bloque CTA que se va a insertar
CTA_BLOCK = """
    <!-- CTA: precio actual -->
    <div style="margin: 2rem 0; padding: 1.25rem 1.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; text-align: center;">
      <p style="margin: 0 0 0.75rem; font-size: 1rem; color: #166534; font-weight: 600;">
        📈 ¿Querés saber cuánto vale el dólar <strong>hoy</strong>?
      </p>
      <a href="/" style="display: inline-block; background: #16a34a; color: #fff; padding: 0.6rem 1.4rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem;">
        Ver cotización en tiempo real →
      </a>
    </div>

    <!-- Links internos SEO -->
    <div style="margin: 1.5rem 0; padding: 1rem 1.25rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
      <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">También te puede interesar</p>
      <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.95rem; line-height: 2;">
        <li><a href="/aprender/que-es-el-dolar-blue/">¿Qué es el dólar blue en Argentina?</a></li>
        <li><a href="/aprender/que-es-el-dolar-mep/">¿Qué es el dólar MEP?</a></li>
        <li><a href="/aprender/brecha-cambiaria/">¿Qué es la brecha cambiaria?</a></li>
      </ul>
    </div>

"""

MARCADOR = '<p><a href="/historico/">Ver todos los históricos</a></p>'

def procesar():
    carpeta_base = os.path.dirname(os.path.abspath(__file__))
    modificados = 0
    omitidos = 0
    errores = 0

    for raiz, dirs, archivos in os.walk(carpeta_base):
        for archivo in archivos:
            if archivo != "index.html":
                continue

            ruta = os.path.join(raiz, archivo)

            try:
                with open(ruta, "r", encoding="utf-8") as f:
                    contenido = f.read()

                # Saltar si ya tiene el CTA
                if "Ver cotización en tiempo real" in contenido:
                    omitidos += 1
                    continue

                # Insertar CTA antes del marcador
                if MARCADOR not in contenido:
                    print(f"  ⚠️  Sin marcador: {ruta}")
                    errores += 1
                    continue

                nuevo = contenido.replace(MARCADOR, CTA_BLOCK + "    " + MARCADOR)

                with open(ruta, "w", encoding="utf-8") as f:
                    f.write(nuevo)

                modificados += 1

            except Exception as e:
                print(f"  ❌ Error en {ruta}: {e}")
                errores += 1

    print("\n" + "="*40)
    print(f"✅ Modificados:  {modificados}")
    print(f"⏭️  Ya tenían CTA: {omitidos}")
    print(f"❌ Errores:      {errores}")
    print("="*40)
    input("\nPresioná Enter para cerrar...")

procesar()
