#!/usr/bin/env python3
"""
OstéoCabinet — Serveur local (Version SQL)
Données stockées dans osteo.db (SQLite).
"""

import http.server
import json
import os
import threading
import time
import webbrowser
import sqlite3
import shutil
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import base64
from urllib.parse import urlparse, parse_qs

PORT = 5180
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "osteo.db")
IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "images")

os.makedirs(IMAGES_DIR, exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Structure cible des tables
    tables = {
        "patients": """
            id TEXT PRIMARY KEY,
            nom TEXT, prenom TEXT, dateNaissance TEXT, sexe TEXT, nss TEXT,
            lateralite TEXT, adresse TEXT, codePostal TEXT, ville TEXT,
            telephone TEXT, email TEXT, medecin TEXT, profession TEXT,
            situationPro TEXT, mutuelle TEXT, orientation TEXT, notes TEXT, motif TEXT,
            antecedentsMedicaux TEXT, antecedentsTrauma TEXT, allergies TEXT,
            chirurgie TEXT, digestif TEXT, sport TEXT, gyneco TEXT,
            traitements TEXT, contraIndications TEXT, noteImportante TEXT, updatedAt TEXT, createdAt TEXT
        """,
        "seances": """
            id TEXT PRIMARY KEY, patientId TEXT, date TEXT, heure TEXT,
            duree INTEGER, type TEXT, montant REAL, statut TEXT,
            anamnese TEXT, bilan TEXT, conseils TEXT,
            prochaine TEXT, updatedAt TEXT, createdAt TEXT,
            FOREIGN KEY(patientId) REFERENCES patients(id)
        """,
        "factures": """
            id TEXT PRIMARY KEY, numero TEXT, date TEXT, patientId TEXT,
            montant REAL, paiement TEXT, statut TEXT, notes TEXT,
            sentAt TEXT, updatedAt TEXT, createdAt TEXT,
            FOREIGN KEY(patientId) REFERENCES patients(id)
        """,
        "facture_seances": """
            factureId TEXT, seanceId TEXT,
            PRIMARY KEY (factureId, seanceId),
            FOREIGN KEY(factureId) REFERENCES factures(id),
            FOREIGN KEY(seanceId) REFERENCES seances(id)
        """,
        "settings": "id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT"
    }

    for table, schema in tables.items():
        cursor.execute(f"CREATE TABLE IF NOT EXISTS {table} ({schema})")
        
        # Migration : Ajout des colonnes manquantes pour les utilisateurs existants
        cursor.execute(f"PRAGMA table_info({table})")
        existing_cols = [row[1] for row in cursor.fetchall()]
        
        # On parse le schéma pour trouver les colonnes définies
        defined_cols = []
        for line in schema.split(','):
            parts = line.strip().split()
            if not parts: continue
            # Nettoye le nom de la colonne (enlève parentheses de fin, espaces, etc.)
            col_name = parts[0].strip().replace('(', '').replace(')', '')
            if not col_name: continue
            if col_name.upper() not in ["FOREIGN", "PRIMARY", "CHECK"]:
                defined_cols.append(col_name)
        
        for col in defined_cols:
            if col not in existing_cols:
                print(f"Migration : Ajout de la colonne {col} à la table {table}")
                try:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} TEXT")
                except Exception as e:
                    print(f"Erreur migration {table}.{col} : {e}")

    # Initialisation settings par défaut
    cursor.execute("SELECT 1 FROM settings WHERE id = 1")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO settings (id, data) VALUES (1, ?)", (json.dumps({}),))
    
    conn.commit()
    conn.close()

init_db()

class OsteoHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, format, *args): pass

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_cors(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    def do_OPTIONS(self):
        self.send_cors()

    def do_GET(self):
        parsed = urlparse(self.path)
        parts = [p for p in parsed.path.split("/") if p]

        if parts and parts[0] == "api":
            conn = get_db()
            cursor = conn.cursor()

            if len(parts) == 1:
                # GET /api -> Return everything (legacy support)
                res = {
                    "patients": [dict(r) for r in cursor.execute("SELECT * FROM patients").fetchall()],
                    "seances": [dict(r) for r in cursor.execute("SELECT * FROM seances").fetchall()],
                    "factures": [],
                    "settings": json.loads(cursor.execute("SELECT data FROM settings WHERE id = 1").fetchone()[0])
                }
                # Reconstitute factures with seanceIds
                facts = cursor.execute("SELECT * FROM factures").fetchall()
                for f in facts:
                    f_dict = dict(f)
                    s_ids = [r[0] for r in cursor.execute("SELECT seanceId FROM facture_seances WHERE factureId = ?", (f_dict["id"],)).fetchall()]
                    f_dict["seanceIds"] = s_ids
                    res["factures"].append(f_dict)
                
                self.send_json(200, res)
                conn.close()
                return

            collection = parts[1]

            if collection == "settings":
                row = cursor.execute("SELECT data FROM settings WHERE id = 1").fetchone()
                self.send_json(200, json.loads(row[0]) if row else {})
            elif collection == "patients":
                if len(parts) == 2:
                    self.send_json(200, [dict(r) for r in cursor.execute("SELECT * FROM patients").fetchall()])
                else:
                    row = cursor.execute("SELECT * FROM patients WHERE id = ?", (parts[2],)).fetchone()
                    self.send_json(200, dict(row) if row else {"error": "Not found"})
            elif collection == "seances":
                if len(parts) == 2:
                    self.send_json(200, [dict(r) for r in cursor.execute("SELECT * FROM seances").fetchall()])
                else:
                    row = cursor.execute("SELECT * FROM seances WHERE id = ?", (parts[2],)).fetchone()
                    self.send_json(200, dict(row) if row else {"error": "Not found"})
            elif collection == "factures":
                if len(parts) == 2:
                    facts = cursor.execute("SELECT * FROM factures").fetchall()
                    res = []
                    for f in facts:
                        d = dict(f)
                        d["seanceIds"] = [r[0] for r in cursor.execute("SELECT seanceId FROM facture_seances WHERE factureId = ?", (d["id"],)).fetchall()]
                        res.append(d)
                    self.send_json(200, res)
                else:
                    row = cursor.execute("SELECT * FROM factures WHERE id = ?", (parts[2],)).fetchone()
                    if row:
                        d = dict(row)
                        d["seanceIds"] = [r[0] for r in cursor.execute("SELECT seanceId FROM facture_seances WHERE factureId = ?", (d["id"],)).fetchall()]
                        self.send_json(200, d)
                    else:
                        self.send_json(404, {"error": "Not found"})
            elif collection == "version":
                version_path = os.path.join(os.path.dirname(__file__), "version.json")
                if os.path.exists(version_path):
                    with open(version_path, "r") as f:
                        self.send_json(200, json.load(f))
                else:
                    self.send_json(200, {"version": "1.0.0"})
            elif collection == "check-update":
                import urllib.request
                repo = parsed.query.replace("repo=", "") if "repo=" in parsed.query else ""
                if not repo:
                    self.send_json(400, {"error": "Dépôt GitHub non spécifié"})
                    return
                try:
                    req = urllib.request.Request(f"https://api.github.com/repos/{repo}/releases/latest", headers={"User-Agent": "OstéoCabinet-Updater"})
                    with urllib.request.urlopen(req) as response:
                        data = json.loads(response.read().decode())
                        self.send_json(200, {
                            "tag": data.get("tag_name"),
                            "name": data.get("name"),
                            "body": data.get("body"),
                            "zip_url": data.get("zipball_url")
                        })
                except Exception as e:
                    self.send_json(500, {"error": str(e)})
            elif collection == "browse-folder":
                import tkinter as tk
                from tkinter import filedialog
                root = tk.Tk()
                root.withdraw()
                root.attributes("-topmost", True)
                folder_selected = filedialog.askdirectory()
                root.destroy()
                self.send_json(200, {"path": folder_selected if folder_selected else ""})
            else:
                self.send_json(404, {"error": "Collection inconnue"})
            
            conn.close()
            return

        super().do_GET()

    def filter_cols(self, cursor, table, data):
        cursor.execute(f"PRAGMA table_info({table})")
        cols = [row[1] for row in cursor.fetchall()]
        return {k: v for k, v in data.items() if k in cols}

    def do_POST(self):
        parsed = urlparse(self.path)
        parts = [p for p in parsed.path.split("/") if p]
        if not parts or parts[0] != "api": return

        collection = parts[1] if len(parts) > 1 else ""

        if collection == "upload-image":
            self.handle_upload_image()
            return

        if collection == "send-email":
            self.handle_send_email()
            return

        if collection == "test-smtp":
            self.handle_test_smtp()
            return

        if collection == "apply-update":
            try:
                import urllib.request
                import zipfile
                import io
                
                body = self.read_body()
                zip_url = body.get("zip_url")
                if not zip_url:
                    self.send_json(400, {"error": "URL du ZIP absente"})
                    return
                
                # Télécharger le ZIP
                req = urllib.request.Request(zip_url, headers={"User-Agent": "OstéoCabinet-Updater"})
                with urllib.request.urlopen(req) as response:
                    zip_data = response.read()
                
                # Extraire le ZIP
                root_dir = os.path.dirname(os.path.abspath(__file__))
                with zipfile.ZipFile(io.BytesIO(zip_data)) as z:
                    # Trouver le dossier racine dans le ZIP (ex: owner-repo-hash/)
                    zip_root = z.namelist()[0].split('/')[0] if z.namelist() else ""
                    
                    for info in z.infolist():
                        if info.is_dir(): continue
                        
                        # Retirer le dossier racine du ZIP du chemin
                        rel_path = info.filename
                        if zip_root and rel_path.startswith(zip_root + "/"):
                            rel_path = rel_path[len(zip_root)+1:]
                        
                        if not rel_path: continue
                        
                        # Fichiers à NE JAMAIS écraser
                        EXCLUDE_FILES = ["osteo.db", "osteo.db-journal", "osteo.db.tmp", "version.json"]
                        EXCLUDE_DIRS = ["backups", "images", ".git"]
                        
                        if rel_path in EXCLUDE_FILES: continue
                        if any(rel_path.startswith(d + "/") for d in EXCLUDE_DIRS): continue
                        
                        dest_path = os.path.join(root_dir, rel_path)
                        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                        
                        with z.open(info) as src, open(dest_path, "wb") as dst:
                            dst.write(src.read())
                
                # Mettre à jour version.json
                if body.get("tag"):
                    version_path = os.path.join(root_dir, "version.json")
                    with open(version_path, "w") as f:
                        json.dump({"version": body["tag"], "updateDate": time.strftime("%Y-%m-%d")}, f)
                
                self.send_json(200, {"status": "success"})
            except Exception as e:
                self.send_json(500, {"error": str(e)})
            return

        if collection == "backup":
            try:
                # Get custom backup path from settings
                conn = get_db()
                row = conn.execute("SELECT data FROM settings WHERE id = 1").fetchone()
                settings = json.loads(row[0]) if row else {}
                conn.close()

                custom_path = settings.get("backupPath")
                if custom_path and os.path.isdir(custom_path):
                    backup_dir = custom_path
                else:
                    backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backups")
                
                os.makedirs(backup_dir, exist_ok=True)
                timestamp = time.strftime("%Y%m%d-%H%M%S")
                backup_filename = f"osteo_backup_{timestamp}.db"
                backup_path = os.path.join(backup_dir, backup_filename)
                
                # Use sqlite3 backup API for safety with active connections
                src = sqlite3.connect(DB_FILE)
                dst = sqlite3.connect(backup_path)
                with dst:
                    src.backup(dst)
                dst.close()
                src.close()
                
                self.send_json(200, {"status": "success", "file": backup_filename})
            except Exception as e:
                self.send_json(500, {"error": str(e)})
            return

        if collection == "restore-backup":
            try:
                import cgi
                import io
                
                # Utiliser cgi.FieldStorage pour le parsing multipart
                ctype, pdict = cgi.parse_header(self.headers.get('Content-Type'))
                if ctype == 'multipart/form-data':
                    # On doit fournir fp, headers et d'autres infos
                    # Mais comme on a déjà lu le body pour d'autres endpoints, c'est délicat.
                    # On va utiliser une approche plus directe pour ne pas tout casser.
                    
                    form = cgi.FieldStorage(
                        fp=self.rfile,
                        headers=self.headers,
                        environ={'REQUEST_METHOD': 'POST',
                                 'CONTENT_TYPE': self.headers['Content-Type'],
                                 }
                    )
                    
                    if 'file' in form:
                        file_item = form['file']
                        file_data = file_item.file.read()
                        
                        if file_data:
                            # Write to a temp file first
                            temp_path = DB_FILE + ".tmp"
                            with open(temp_path, "wb") as f:
                                f.write(file_data)
                            
                            # Basic validation: is it a sqlite file?
                            if file_data[:15] != b"SQLite format 3":
                                os.remove(temp_path)
                                self.send_json(400, {"error": "Le fichier n'est pas une base de données SQLite valide."})
                                return

                            if os.path.exists(DB_FILE):
                                os.replace(temp_path, DB_FILE)
                            else:
                                os.rename(temp_path, DB_FILE)
                            
                            self.send_json(200, {"status": "success"})
                        else:
                            self.send_json(400, {"error": "Le fichier est vide."})
                    else:
                        self.send_json(400, {"error": "Aucun fichier 'file' trouvé dans la requête."})
                else:
                    self.send_json(400, {"error": "Type de contenu invalide."})

            except Exception as e:
                self.send_json(500, {"error": str(e)})
            return
            return

        body = self.read_body()
        conn = get_db()
        cursor = conn.cursor()

        if collection == "settings":
            cursor.execute("UPDATE settings SET data = ? WHERE id = 1", (json.dumps(body, ensure_ascii=False),))
            conn.commit()
            self.send_json(200, body)
        elif collection in ["patients", "seances", "factures"]:
            seance_ids = body.pop("seanceIds", []) if collection == "factures" else []
            filtered_body = self.filter_cols(cursor, collection, body)
            cols = list(filtered_body.keys())
            cursor.execute(f"INSERT INTO {collection} ({','.join(cols)}) VALUES ({','.join(['?']*len(cols))})", list(filtered_body.values()))
            
            if collection == "factures":
                for sid in seance_ids:
                    cursor.execute("INSERT INTO facture_seances (factureId, seanceId) VALUES (?, ?)", (body["id"], sid))
                body["seanceIds"] = seance_ids

            conn.commit()
            self.send_json(201, body)
        
        conn.close()

    def do_PUT(self):
        parsed = urlparse(self.path)
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) < 3: return

        collection, item_id = parts[1], parts[2]
        body = self.read_body()
        conn = get_db()
        cursor = conn.cursor()

        if collection in ["patients", "seances", "factures"]:
            seance_ids = body.pop("seanceIds", []) if collection == "factures" else []
            filtered_body = self.filter_cols(cursor, collection, body)
            cols = [f"{k}=?" for k in filtered_body.keys()]
            cursor.execute(f"UPDATE {collection} SET {','.join(cols)} WHERE id=?", list(filtered_body.values()) + [item_id])
            
            if collection == "factures":
                cursor.execute("DELETE FROM facture_seances WHERE factureId=?", (item_id,))
                for sid in seance_ids:
                    cursor.execute("INSERT INTO facture_seances (factureId, seanceId) VALUES (?, ?)", (item_id, sid))
                body["seanceIds"] = seance_ids

            conn.commit()
            self.send_json(200, body)

        conn.close()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) < 3: return

        collection, item_id = parts[1], parts[2]
        conn = get_db()
        cursor = conn.cursor()

        if collection == "patients":
            cursor.execute("DELETE FROM patients WHERE id=?", (item_id,))
        elif collection == "seances":
            cursor.execute("DELETE FROM seances WHERE id=?", (item_id,))
            cursor.execute("DELETE FROM facture_seances WHERE seanceId=?", (item_id,))
        elif collection == "factures":
            cursor.execute("DELETE FROM factures WHERE id=?", (item_id,))
            cursor.execute("DELETE FROM facture_seances WHERE factureId=?", (item_id,))
        
        conn.commit()
        conn.close()
        self.send_json(200, {"deleted": item_id})

    def handle_send_email(self):
        try:
            body = self.read_body()
            to_email = body.get("to")
            subject = body.get("subject")
            content = body.get("body")
            attachment_b64 = body.get("attachment")
            filename = body.get("filename", "facture.pdf")

            print(f"Tentative d'envoi d'email à : {to_email}")

            # Get SMTP settings from DB
            conn = get_db()
            row = conn.execute("SELECT data FROM settings WHERE id = 1").fetchone()
            raw_settings = row[0] if row else "{}"
            settings = json.loads(raw_settings)
            conn.close()

            smtp_user = settings.get("smtpEmail")
            smtp_pass = settings.get("smtpPassword")
            # Port préféré (appris au fil des envois, par défaut 587)
            preferred_port = settings.get("preferredSmtpPort", 587)

            if not smtp_user or not smtp_pass:
                print("Erreur : Paramètres SMTP non configurés.")
                self.send_json(400, {"error": "Paramètres SMTP (Gmail) non configurés ou non enregistrés."})
                return

            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(content, 'plain'))

            if attachment_b64:
                if "," in attachment_b64:
                    attachment_b64 = attachment_b64.split(",")[1]
                pdf_data = base64.b64decode(attachment_b64)
                part = MIMEApplication(pdf_data, Name=filename)
                part['Content-Disposition'] = f'attachment; filename="{filename}"'
                msg.attach(part)

            def try_send(port):
                if port == 465:
                    print(f"Tentative de connexion SMTP_SSL (465)...")
                    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
                        server.login(smtp_user, smtp_pass)
                        server.send_message(msg)
                    return True
                else:
                    print(f"Tentative de connexion SMTP STARTTLS (587)...")
                    with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as server:
                        server.starttls()
                        server.login(smtp_user, smtp_pass)
                        server.send_message(msg)
                    return True

            # Stratégie intelligente d'envoi
            success_port = None
            try:
                # 1. On tente le port qui a fonctionné la dernière fois
                try_send(preferred_port)
                success_port = preferred_port
                print(f"Email envoyé via le port préféré ({preferred_port}).")
            except Exception as e_pref:
                print(f"Échec sur le port {preferred_port}: {e_pref}")
                # 2. En cas d'échec, on tente l'autre port
                other_port = 465 if preferred_port == 587 else 587
                try:
                    try_send(other_port)
                    success_port = other_port
                    print(f"Email envoyé via le port alternatif ({other_port}).")
                    
                    # 3. Comme l'autre port a réussi, on le mémorise comme nouveau port préféré
                    try:
                        settings["preferredSmtpPort"] = other_port
                        conn = get_db()
                        conn.execute("UPDATE settings SET data = ? WHERE id = 1", (json.dumps(settings),))
                        conn.commit()
                        conn.close()
                        print(f"Nouveau port préféré mémorisé : {other_port}")
                    except Exception as e_db:
                        print(f"Erreur lors de la mise à jour du port préféré en DB: {e_db}")
                except Exception as e_alt:
                    print(f"Échec total sur les deux ports.")
                    raise Exception(f"Impossible de se connecter au serveur SMTP (465 & 587). Erreur: {e_alt}")

            self.send_json(200, {"status": "success"})
        except Exception as e:
            error_msg = str(e)
            print(f"Erreur envoi email: {error_msg}")
            self.send_json(500, {"error": f"Erreur lors de l'envoi : {error_msg}"})

    def handle_test_smtp(self):
        try:
            body = self.read_body()
            to_email = body.get("to")
            if not to_email:
                self.send_json(400, {"error": "Adresse email de destination manquante."})
                return

            print(f"--- TEST SMTP ---")
            print(f"Destinataire : {to_email}")

            conn = get_db()
            row = conn.execute("SELECT data FROM settings WHERE id = 1").fetchone()
            raw_settings = row[0] if row else "{}"
            settings = json.loads(raw_settings)
            conn.close()

            smtp_user = settings.get("smtpEmail")
            smtp_pass = settings.get("smtpPassword")
            
            if not smtp_user or not smtp_pass:
                print("Erreur : Paramètres SMTP non configurés.")
                self.send_json(400, {"error": "Paramètres SMTP non configurés en base de données."})
                return

            print(f"Expéditeur : {smtp_user}")
            
            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = to_email
            msg['Subject'] = "OstéoCabinet - Test de configuration SMTP"
            
            body_text = f"Ceci est un email de test envoyé par OstéoCabinet.\n\n" \
                        f"Si vous recevez ce message, votre configuration SMTP pour {smtp_user} est correcte.\n\n" \
                        f"Date du test : {time.strftime('%Y-%m-%d %H:%M:%S')}"
            msg.attach(MIMEText(body_text, 'plain'))

            preferred_port = settings.get("preferredSmtpPort", 587)
            
            def try_send(port):
                if port == 465:
                    print(f"Tentative de connexion SMTP_SSL (465)...")
                    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
                        server.login(smtp_user, smtp_pass)
                        server.send_message(msg)
                    return True
                else:
                    print(f"Tentative de connexion SMTP STARTTLS (587)...")
                    with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as server:
                        # server.set_debuglevel(1)
                        server.starttls()
                        server.login(smtp_user, smtp_pass)
                        server.send_message(msg)
                    return True

            try:
                try_send(preferred_port)
                self.send_json(200, {"status": "success", "message": f"Succès via le port {preferred_port}"})
            except Exception as e_pref:
                print(f"Échec port {preferred_port}: {e_pref}")
                other_port = 465 if preferred_port == 587 else 587
                try:
                    try_send(other_port)
                    # Update database with working port
                    settings["preferredSmtpPort"] = other_port
                    conn = get_db()
                    conn.execute("UPDATE settings SET data = ? WHERE id = 1", (json.dumps(settings),))
                    conn.commit()
                    conn.close()
                    self.send_json(200, {"status": "success", "message": f"Succès via le port {other_port} (mis à jour)"})
                except Exception as e_alt:
                    print(f"Échec total: {e_alt}")
                    self.send_json(500, {"error": f"Échec de connexion SMTP: {str(e_alt)}"})

        except Exception as e:
            print(f"Erreur test SMTP: {e}")
            self.send_json(500, {"error": str(e)})

    def handle_upload_image(self):
        try:
            import cgi
            ctype, pdict = cgi.parse_header(self.headers.get('Content-Type'))
            if ctype == 'multipart/form-data':
                form = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={'REQUEST_METHOD': 'POST',
                             'CONTENT_TYPE': self.headers['Content-Type'],
                             }
                )
                
                if 'file' in form:
                    file_item = form['file']
                    file_data = file_item.file.read()
                    file_name = file_item.filename
                    
                    if not file_name:
                        # Fallback if filename is missing
                        file_name = "upload.png"
                    
                    # Ensure extension if missing or generic
                    if "." not in file_name:
                        file_name += ".png"

                    dest = os.path.join(IMAGES_DIR, os.path.basename(file_name))
                    with open(dest, "wb") as f:
                        f.write(file_data)
                    
                    self.send_json(200, {"path": "images/" + os.path.basename(file_name)})
                else:
                    self.send_json(400, {"error": "Aucun fichier trouvé"})
            else:
                self.send_json(400, {"error": "Type de contenu invalide"})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

def open_browser():
    time.sleep(1.2)
    webbrowser.open(f"http://localhost:{PORT}")

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"OstéoCabinet SQL lancé sur http://localhost:{PORT}")
    threading.Thread(target=open_browser, daemon=True).start()
    server = http.server.ThreadingHTTPServer(("localhost", PORT), OsteoHandler)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
