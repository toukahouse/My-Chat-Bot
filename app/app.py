import os
import json
from flask import Flask, request, Response, render_template
from dotenv import load_dotenv
from flask_cors import CORS
from werkzeug.utils import secure_filename
import psycopg2
from urllib.parse import urlparse
from waitress import serve

try:
    from google import genai
    from google.genai import types
except ModuleNotFoundError:
    print("KESALAHAN: Library 'google-genai' tidak ditemukan.")
    exit()

# --- SETUP DASAR ---
load_dotenv()
app = Flask(__name__)
# GANTI BARIS CORS(app) DENGAN INI
CORS(app, origins="*", methods=["GET", "POST", "OPTIONS"], headers=["Content-Type"])

UPLOAD_FOLDER = "temp_uploads"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


# === FUNGSI STREAM GENERATOR (SEKARANG DI LUAR 'CHAT') ===
def stream_generator(
    image_part,
    image_uri_info,
    history,
    user_message,
    character_info,
    user_info,
    memory_entries,
    world_info_entries,
    npc_entries,
    summary,
    selected_model,
    custom_api_key,
):
    def format_history_entry(msg):
        role = msg.get("role")
        content = msg.get("parts", [""])[0]

        if role == "model":
            thoughts = msg.get("thoughts", "").strip()
            if thoughts:
                # Gabungkan thoughts dan content jika ada
                return f"model: (My thought process: {thoughts}) {content}"
            else:
                # Jika tidak ada thoughts, format seperti biasa
                return f"model: {content}"
        else:  # Untuk role 'user'
            return f"user: {content}"

    try:
        if image_uri_info:
            uri_data = json.dumps(
                {
                    "type": "image_uri",
                    "uri": image_uri_info["uri"],
                    "mime": image_uri_info["mime"],
                }
            )
            yield f"data: {uri_data}\n\n"
        api_key_to_use = custom_api_key or os.getenv("GEMINI_API_KEY")
        if not api_key_to_use:
            raise ValueError(
                "Tidak ada API Key yang tersedia (baik dari user maupun .env)"
            )

        # --- 2. Buat client Gemini sesuai dokumentasi BARU ---
        client = genai.Client(api_key=api_key_to_use)
        print(f"✅ Client Gemini dibuat dengan model: {selected_model}")
        # --- 1. Ambil semua info dasar ---
        system_instruction = character_info.get("system_instruction", "")
        persona_text = character_info.get("persona", "")
        example_dialogs = character_info.get("example_dialogs", "")
        user_persona_text = user_info.get("persona", "Seorang pengguna biasa.")
        user_name = user_info.get("name", "User")
        temperature_value = float(character_info.get("temperature", 0.9))

        persona_text_block = (
            f"<persona_karakter>\n{persona_text}\n</persona_karakter>\n\n"
            if persona_text
            else ""
        )
        user_persona_block = (
            f"Kamu sedang berinteraksi dengan seseorang bernama '{user_name}'. Berikut adalah deskripsi tentangnya:\n<persona_user>\n{user_persona_text}\n</persona_user>\n\n"
            if user_persona_text
            else ""
        )
        memory_block = ""
        if memory_entries:
            formatted_memories = "\n".join([f"- {entry}" for entry in memory_entries])
            memory_block = f"Ini berisi alur cerita saat ini, moment sebelumnya atau moment penting...\n<memori_penting>\n{formatted_memories}\n</memori_penting>\n\n"
        world_info_block = ""
        if world_info_entries:
            formatted_world_infos = "\n".join(
                [f"- {entry}" for entry in world_info_entries]
            )
            world_info_block = f"Berikut adalah informasi, lore, dan konteks tentang dunia roleplay saat ini...\n<info_dunia>\n{formatted_world_infos}\n</info_dunia>\n\n"
        npc_block = ""
        if npc_entries:
            formatted_npcs = "\n\n---\n\n".join(npc_entries)
            npc_block = f"Berikut adalah deskripsi karakter sampingan (NPC) yang akan muncul saat roleplay...\n<karakter_sampingan>\n{formatted_npcs}\n</karakter_sampingan>\n\n"
        history_block = ""
        if summary and len(history) > 10:
            # Kita perpanjang ingatannya dari 8 jadi 20 pesan terakhir! Ini kuncinya.
            recent_history = history[-20:]
            history_text = "\n".join(
                [format_history_entry(msg) for msg in recent_history]
            )
            # Jangan lupa update teks penjelasannya juga biar AI lebih paham konteksnya
            history_block = f"Berikut adalah ringkasan dari percakapan yang sudah sangat panjang...\n<ringkasan>\n{summary}\n</ringkasan>\n\nDan ini adalah 20 pesan terakhir untuk menjaga konteks...\n<chat_terbaru>\n{history_text}\n</chat_terbaru>"
        else:
            if history:
                history_text = "\n".join([format_history_entry(msg) for msg in history])
                history_block = f"RIWAYAT CHAT SEBELUMNYA:\n{history_text}"

        full_prompt = (
            f"Kamu adalah sebuah karakter AI dengan peran dan instruksi sebagai berikut\n"
            f"{persona_text_block}"
            f"{user_persona_block}"
            f"{memory_block}"
            f"{world_info_block}"
            f"{npc_block}"
            f"Ikuti instruksi sistem ini, ikuti setiap instruksi dan aturan yang ditulis dan ini bersifat mutlak dan wajib untuk dipatuhi :\n<instruksi_sistem>\n{system_instruction}\n</instruksi_sistem>\n\n"
            f"- Selalu berikan respons yang deskriptif, detail, dan panjang dalam beberapa paragraf. Jangan pernah menjawab dengan satu kalimat singkat."
            f"- Jelaskan tindakan atau pikiran yang banyaknya 20%, dan dialog percakapan yang banyaknya 80% untuk karaktermu secara mendalam. mengikuti semua instruksi di atas.\n\n"
            f"Gunakan contoh dialog ini sebagai referensi gaya bicara kamu yang informal.. \n<contoh_dialog>\n{example_dialogs}\n</contoh_dialog>\n\n"
            f"---\n\n"
            f"{history_block}\n\n"
            f"INGAT: Selalu gunakan gaya bahasa yang santai dan informal sesuai <instruksi_sistem> di atas. "
            f"Jangan pernah gunakan kata 'akan' atau 'tentu saja'.\n"
            f"Sekarang giliranmu merespon sebagai {character_info.get('name', 'karakter')}. Ingat, jawab dengan gaya bicaramu yang santai dan informal.\n"
            f"model:"
        )
        print(f"Mengirim prompt ke Gemini...")

        # Gabungkan semua konfigurasi, termasuk safety settings
        config = types.GenerateContentConfig(
            temperature=temperature_value,
            thinking_config=types.ThinkingConfig(include_thoughts=True),
            safety_settings=[  # <-- Langsung didefinisikan di sini
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
            ],
        )
        user_turn_parts = []
        if image_part:
            user_turn_parts.append(image_part)
        user_turn_parts.append(f'{user_name} bilang: "{user_message}"')

        # 'contents' adalah list dari setiap 'turn' dalam percakapan.
        # Turn pertama adalah prompt sistem + history.
        # Turn kedua adalah pesan dari user (teks + gambar).
        contents_to_send = [
            full_prompt,  # Ini dianggap sebagai 'turn' dari AI/sistem
            user_turn_parts,  # Ini dianggap sebagai 'turn' dari user
        ]  # Selalu tambahkan teks prompt

        # Panggil AI dengan konten yang sudah digabung
        response_stream = client.models.generate_content_stream(
            model=selected_model,
            contents=contents_to_send,  # <-- Gunakan list yang sudah kita buat
            config=config,
        )

        # --- 6. Proses dan kirim hasil streaming (VERSI FINAL & TANGGUH) ---
        if response_stream is None:
            print(
                "❌ response_stream adalah None. Menghentikan proses untuk request ini."
            )
            yield f"data: {json.dumps({'type': 'error', 'content': 'Gagal mendapatkan respon dari server AI.'})}\n\n"
            return  # Hentikan fungsi generator ini sepenuhnya

        try:
            for chunk in response_stream:
                # Cek dulu apakah chunk punya kandidat, kadang bisa kosong
                if not chunk.candidates:
                    # print("Chunk kosong diterima, lanjut...") # Uncomment untuk debug
                    continue

                # Kunci utama ada di sini:
                # Kita hanya proses 'parts' jika ada.
                if chunk.candidates[0].content and chunk.candidates[0].content.parts:
                    for part in chunk.candidates[0].content.parts:
                        # Cek apakah ini bagian 'thought'
                        if (
                            hasattr(part, "thought")
                            and part.thought
                            and getattr(part, "text", None)
                        ):
                            data_to_send = {"type": "thought", "content": part.text}
                            yield f"data: {json.dumps(data_to_send)}\n\n"
                        # Cek apakah ini bagian 'reply' biasa
                        elif getattr(part, "text", None):
                            data_to_send = {"type": "reply", "content": part.text}
                            yield f"data: {json.dumps(data_to_send)}\n\n"

        except types.InternalServerError as e:
            # Tangkap error 500 secara spesifik
            print(f"❌ Terjadi Internal Server Error dari API Gemini: {e}")
            error_content = f"500 INTERNAL. {str(e)}"
            yield f"data: {json.dumps({'type': 'error', 'content': error_content})}\n\n"

    except Exception as e:
        # Menangkap error lain yang mungkin terjadi selama iterasi
        print(f"❌ Terjadi error tak terduga DI DALAM loop streaming: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': f'Terjadi masalah saat streaming: {str(e)}'})}\n\n"


# --- Route untuk Menyajikan Halaman Utama ---
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/<page_name>")
def show_page(page_name):
    # Cek untuk keamanan, pastikan yang diminta adalah file html
    if not page_name.endswith(".html"):
        return "Not Found", 404
    try:
        # Coba render template dengan nama yang diminta
        return render_template(page_name)
    except:
        # Jika file tidak ada di folder templates, kirim 404
        return "Not Found", 404


# === ENDPOINT UNTUK SUMMARIZE ===
# === ENDPOINT UNTUK SUMMARIZE (VERSI BARU DENGAN AKUMULASI) ===
@app.route("/summarize", methods=["POST"])
def summarize():
    try:
        data = request.json
        history_to_summarize = data.get("history", [])
        old_summary = data.get("old_summary", "").strip()  # <-- AMBIL RINGKASAN LAMA
        custom_api_key = data.get("api_key", None)
        selected_model = data.get("model", "models/gemini-2.5-flash")

        if not history_to_summarize:
            # Jika tidak ada history baru, kembalikan saja ringkasan lama apa adanya.
            return Response(
                json.dumps({"summary": old_summary}),
                status=200,
                mimetype="application/json",
            )

        history_text = "\n".join(
            [f"{msg['role']}: {msg['parts'][0]}" for msg in history_to_summarize]
        )
        summarization_prompt = (
            f"Kamu adalah AI yang bertugas meringkas percakapan. Baca PENGGALAN PERCAKAPAN di bawah, lalu buat ringkasan singkat dalam bentuk paragraf.\n\n"
            f"ATURAN RINGKASAN:\n"
            f"- Gaya bahasa HARUS informal dan santai.\n"
            f"- Fokus pada detail penting: janji spesifik, kesepakatan, nama, tempat, dan perubahan emosi.\n"
            f"- JANGAN menambahkan opinimu atau informasi yang tidak ada di dalam teks.\n\n"
            f"PENTING: Jawabanmu HANYA BOLEH berisi paragraf ringkasan itu sendiri. JANGAN sertakan kalimat pembuka seperti 'Berikut adalah ringkasannya' atau 'Oke, ini ringkasannya'. Langsung tulis poin-poin ringkasannya.\n\n"
            f"--- PENGGALAN PERCAKAPAN YANG HARUS DIRINGKAS ---\n"
            f"{history_text}\n"
            f"--- SELESAI ---"
        )

        api_key_to_use = custom_api_key or os.getenv("GEMINI_API_KEY")
        if not api_key_to_use:
            raise ValueError("Tidak ada API Key yang tersedia untuk meringkas.")

        client = genai.Client(api_key=api_key_to_use)

        # Minta AI meringkas HANYA potongan chat yang baru
        response = client.models.generate_content(
            model=selected_model, contents=summarization_prompt
        )

        # ▼▼▼ PERBAIKAN: Cek dulu apakah AI memberikan balasan teks ▼▼▼
        new_summary_chunk = ""  # Inisialisasi dengan string kosong sebagai default
        if response.text:
            # Jika response.text tidak kosong (bukan None), baru kita proses
            new_summary_chunk = response.text.strip()
        # ▲▲▲ SELESAI PERBAIKAN ▲▲▲

        print(f"Potongan ringkasan baru diterima: {new_summary_chunk}")

        # --- INI BAGIAN PENTINGNYA: GABUNGKAN DI SINI ---
        if old_summary:
            # Jika ada ringkasan lama, gabungkan dengan yang baru
            final_summary = f"{old_summary}\n\n{new_summary_chunk}"
        else:
            # Jika ini ringkasan pertama, jadikan ini sebagai ringkasan final
            final_summary = new_summary_chunk

        print(f"Ringkasan final yang akan dikirim kembali: {final_summary}")

        return Response(
            json.dumps({"summary": final_summary}),  # <-- KIRIM HASIL GABUNGAN
            status=200,
            mimetype="application/json",
        )

    except Exception as e:
        print(f"❌ Error saat meringkas: {e}")
        return Response(
            json.dumps({"error": f"Gagal meringkas di server: {e}"}),
            status=500,
            mimetype="application/json",
        )


# === ENDPOINT UTAMA UNTUK CHAT ===
# === GANTI TOTAL ENDPOINT CHAT DENGAN INI ===
@app.route("/chat", methods=["POST"])
def chat():
    # Validasi request, pastikan ini adalah form data
    if "message" not in request.form:
        return Response(
            json.dumps({"error": "Request harus dalam format FormData"}), status=400
        )

    try:
        # Ambil semua data dari request.form
        user_message = request.form.get("message")
        history = json.loads(request.form.get("history", "[]"))
        character_info = json.loads(request.form.get("character", "{}"))
        user_info = json.loads(request.form.get("user", "{}"))
        memory_entries = json.loads(request.form.get("memory", "[]"))
        world_info_entries = json.loads(request.form.get("world_info", "[]"))
        npc_entries = json.loads(request.form.get("npcs", "[]"))
        summary = request.form.get("summary", "")
        selected_model = request.form.get("model", "models/gemini-2.5-flash")
        custom_api_key = request.form.get("api_key", None)
    except json.JSONDecodeError:
        return Response(
            json.dumps({"error": "Format JSON pada salah satu data form tidak valid"}),
            status=400,
        )

    image_part = None
    image_uri_to_return = (
        None  # Variabel untuk menyimpan URI yang akan dikirim ke generator
    )

    # --- LOGIKA BARU UNTUK GAMBAR ---
    active_image_uri = request.form.get("active_image_uri", None)
    active_image_mime = request.form.get("active_image_mime", None)

    # Proses file gambar jika ada
    if "image" in request.files and request.files["image"].filename != "":
        image_file = request.files["image"]
        temp_file_path = None
        try:
            api_key_for_upload = custom_api_key or os.getenv("GEMINI_API_KEY")
            if not api_key_for_upload:
                raise ValueError("API Key tidak tersedia untuk upload file.")

            # Gunakan client yang sama seperti caramu
            upload_client = genai.Client(api_key=api_key_for_upload)

            filename = secure_filename(image_file.filename)
            temp_file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            image_file.save(temp_file_path)

            print(f"Mengunggah file BARU: {temp_file_path} ke Google...")
            uploaded_file = upload_client.files.upload(file=temp_file_path)

            # Ini dia bagian pentingnya!
            image_part = (
                uploaded_file  # Gunakan objek file langsung untuk request pertama
            )
            image_uri_to_return = {
                "uri": uploaded_file.uri,
                "mime": image_file.mimetype,  # Kita juga kirim tipe filenya
            }
            print(f"File baru berhasil diunggah. URI: {uploaded_file.uri}")

        except Exception as e:
            print(f"❌ Gagal memproses gambar: {e}")
            error_data = json.dumps(
                {"type": "error", "content": f"Gagal upload gambar: {str(e)}"}
            )
            return Response(f"data: {error_data}\n\n", mimetype="text/event-stream")
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)
    elif active_image_uri and active_image_mime:
        try:
            print(f"Menggunakan URI gambar yang sudah ada: {active_image_uri}")
            # Buat 'Part' dari URI yang sudah ada
            image_part = types.Part.from_uri(
                file_uri=active_image_uri, mime_type=active_image_mime
            )
        except Exception as e:
            print(f"❌ Gagal membuat Part dari URI: {e}")
            # Jika gagal, jangan kirim gambar apa pun
            image_part = None
    # Panggil stream_generator dengan semua data
    return Response(
        stream_generator(
            image_part,
            image_uri_to_return,  # Bisa None jika tidak ada gambar, atau berisi file jika ada
            history,
            user_message,
            character_info,
            user_info,
            memory_entries,
            world_info_entries,
            npc_entries,
            summary,
            selected_model,
            custom_api_key,
        ),
        mimetype="text/event-stream",
    )


# 1. Fungsi helper untuk koneksi ke Database PostgreSQL
def get_db_connection():
    """Fungsi ini membaca DATABASE_URL dari .env dan membuat koneksi."""
    try:
        # Baca URL dari environment variable
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise ValueError("DATABASE_URL tidak ditemukan di file .env")

        # Parsing URL jadi komponen-komponen
        result = urlparse(db_url)
        username = result.username
        password = result.password
        database = result.path[1:]
        hostname = result.hostname
        port = result.port

        # Buat koneksi ke database
        conn = psycopg2.connect(
            host=hostname,
            database=database,
            user=username,
            password=password,
            port=port
        )
        return conn
    except Exception as e:
        print(f"❌ GAGAL KONEK KE DATABASE POSTGRESQL: {e}")
        # Return None jika gagal, biar aplikasi tidak crash total
        return None

# 2. Endpoint untuk MENGAMBIL semua sesi dari Gudang Pusat (PostgreSQL)
@app.route("/api/sessions", methods=["GET"])
def get_all_sessions():
    conn = None
    try:
        conn = get_db_connection()
        if conn is None:
            # Jika koneksi gagal, kirim error 503 Service Unavailable
            return Response(json.dumps({"error": "Server tidak bisa terhubung ke database."}), status=503, mimetype='application/json')

        # Pakai 'with' biar cursor otomatis ditutup
        with conn.cursor() as cur:
            # Query ini aku udah sesuaikan 100% sama struktur tabel kamu
            cur.execute("""
                SELECT
                    c.id,
                    c.timestamp,
                    c.summary,
                    c.character_name,
                    c.character_avatar,
                    (SELECT COUNT(*) FROM public.message m WHERE m.conversation_id = c.id) as message_count
                FROM
                    public.conversation c
                ORDER BY
                    c.timestamp DESC;
            """)
            # Ambil semua baris hasil query
            sessions_from_db = cur.fetchall()

        # Ubah data dari format database (tuple) jadi format yang bisa dibaca JS (list of dict)
        sessions_list = []
        for row in sessions_from_db:
            sessions_list.append({
                "id": row[0],
                "timestamp": row[1].isoformat() if row[1] else None, # isoformat() itu standar universal buat tanggal
                "summary": row[2],
                "character_name": row[3],
                "character_avatar": row[4],
                "message_count": row[5]
            })

        # Kirim datanya sebagai JSON
        return Response(json.dumps(sessions_list), status=200, mimetype='application/json')

    except Exception as e:
        print(f"❌ Terjadi kesalahan di endpoint /api/sessions: {e}")
        return Response(json.dumps({"error": "Terjadi kesalahan di server saat mengambil data sesi."}), status=500, mimetype='application/json')
    finally:
        # Apapun yang terjadi, pastikan koneksi ke database ditutup
        if conn is not None:
            conn.close()

# 3. Endpoint untuk MENGHAPUS sesi dari Gudang Pusat (PostgreSQL)
@app.route("/api/sessions/<int:session_id>", methods=["DELETE"])
def delete_session(session_id):
    conn = None
    try:
        conn = get_db_connection()
        if conn is None:
            return Response(json.dumps({"error": "Server tidak bisa terhubung ke database."}), status=503, mimetype='application/json')

        # Kita pakai transaksi, jadi kalau salah satu gagal, semua dibatalkan. Aman!
        with conn.cursor() as cur:
            # Hapus dulu semua 'anak'-nya (pesan-pesan) di tabel messages
            # ...
# Hapus dulu semua 'anak'-nya (pesan-pesan) di tabel message
            cur.execute("DELETE FROM message WHERE conversation_id = %s", (session_id,))
            # Baru hapus 'induk'-nya di tabel conversation
            cur.execute("DELETE FROM conversation WHERE id = %s", (session_id,))

        # Simpan perubahan permanen ke database
        conn.commit()

        print(f"✅ Sesi ID {session_id} dan semua pesannya berhasil dihapus dari database.")
        return Response(json.dumps({"message": "Sesi berhasil dihapus"}), status=200, mimetype='application/json')

    except Exception as e:
        # Jika ada error, batalkan semua perubahan
        if conn:
            conn.rollback()
        print(f"❌ Gagal menghapus sesi ID {session_id}: {e}")
        return Response(json.dumps({"error": "Gagal menghapus sesi di server."}), status=500, mimetype='application/json')
    finally:
        if conn is not None:
            conn.close()

# Taruh ini di app.py, di bawah fungsi get_all_sessions()

# 4. Endpoint untuk MEMBUAT sesi BARU di Gudang Pusat (PostgreSQL)
# Di dalam app.py

# 4. Endpoint untuk MEMBUAT sesi BARU di Gudang Pusat (PostgreSQL)
# Di dalam app.py

# 4. Endpoint untuk MEMBUAT sesi BARU di Gudang Pusat (PostgreSQL)
@app.route("/api/sessions", methods=["POST"])
def create_new_session():
    conn = None
    try:
        # Ambil data yang dikirim dari frontend (JS)
        data = request.json
        char_name = data.get("character_name")
        char_avatar = data.get("character_avatar")
        char_greeting = data.get("character_greeting", "Halo, ada apa?")

        conn = get_db_connection()
        if conn is None:
            return Response(json.dumps({"error": "Server tidak bisa terhubung ke database."}), status=503, mimetype='application/json')

        # Ini adalah satu-satunya query yang harus ada di sini
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO public.conversation (character_name, character_avatar, summary, greeting, timestamp) VALUES (%s, %s, %s, %s, NOW() AT TIME ZONE 'Asia/Makassar') RETURNING id",
                (char_name, char_avatar, 'Percakapan baru dimulai...', char_greeting)
            )
            # Ambil ID yang baru saja dibuat oleh database
            new_session_id = cur.fetchone()[0]
        
        # Simpan perubahan ke database
        conn.commit()

        print(f"✅ Sesi baru berhasil dibuat di database dengan ID: {new_session_id}")
        
        # Kirim kembali ID baru itu ke frontend
        return Response(json.dumps({"new_session_id": new_session_id}), status=201, mimetype='application/json')

    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ Gagal membuat sesi baru: {e}")
        return Response(json.dumps({"error": "Gagal membuat sesi baru di server."}), status=500, mimetype='application/json')
    finally:
        if conn is not None:
            conn.close()

# ===================================================================
# === API ENDPOINTS BARU UNTUK HALAMAN CHAT ===
# ===================================================================

# 5. Endpoint untuk MENGAMBIL semua pesan dari sebuah sesi
@app.route("/api/sessions/<int:session_id>/messages", methods=["GET"])
def get_messages_for_session(session_id):
    conn = None
    # Di dalam fungsi get_messages_for_session(session_id)

    try:
        conn = get_db_connection()
        if conn is None:
            return Response(json.dumps({"error": "Koneksi DB gagal"}), status=503, mimetype='application/json')

        # Kita gabungin semua dalam satu blok 'with' biar efisien
        with conn.cursor() as cur:
            # === Query Pertama: Ambil semua pesan ===
            cur.execute(
                "SELECT id, role, content, thoughts, image_data, timestamp FROM public.message WHERE conversation_id = %s ORDER BY timestamp ASC",
                (session_id,) # Variabel session_id kebaca di sini
            )
            messages_from_db = cur.fetchall()

            messages_list = []
            for row in messages_from_db:
                messages_list.append({
                    "db_id": row[0],
                    "role": row[1],
                    "content": row[2],
                    "thoughts": row[3],
                    "imageData": row[4],
                    "timestamp": row[5].isoformat()
                })
            
            # === Query Kedua: Ambil greeting dari sesi yang sama ===
            cur.execute(
                "SELECT greeting FROM public.conversation WHERE id = %s",
                (session_id,) # Variabel session_id juga kebaca di sini
            )
            result = cur.fetchone()
            greeting = result[0] if result and result[0] is not None else "Selamat datang!"

        # Return dilakukan di luar 'with' block, setelah semua query selesai
        return Response(json.dumps({"messages": messages_list, "greeting": greeting}), status=200, mimetype='application/json')

    except Exception as e:
        print(f"❌ Error di get_messages_for_session: {e}")
        return Response(json.dumps({"error": "Gagal mengambil pesan"}), status=500, mimetype='application/json')
    finally:
        if conn:
            conn.close()


# 6. Endpoint untuk MENYIMPAN pesan BARU
@app.route("/api/messages", methods=["POST"])
def add_new_message():
    conn = None
    try:
        data = request.json
        # Ambil semua data dari frontend
        session_id = data.get("conversation_id")
        role = data.get("role")
        content = data.get("content")
        thoughts = data.get("thoughts", None) # Bisa kosong
        image_data = data.get("imageData", None) # Bisa kosong

        conn = get_db_connection()
        if conn is None:
            return Response(json.dumps({"error": "Koneksi DB gagal"}), status=503, mimetype='application/json')

        with conn.cursor() as cur:
            # Ganti nama tabelnya jadi 'message' (tanpa 's')
            cur.execute(
                "INSERT INTO public.message (conversation_id, role, content, thoughts, image_data, timestamp) VALUES (%s, %s, %s, %s, %s, NOW() AT TIME ZONE 'Asia/Makassar') RETURNING id",
                (session_id, role, content, thoughts, image_data)
            )
            new_message_id = cur.fetchone()[0]
        
        conn.commit()
        return Response(json.dumps({"new_message_id": new_message_id}), status=201, mimetype='application/json')

    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ Error di add_new_message: {e}")
        return Response(json.dumps({"error": "Gagal menyimpan pesan"}), status=500, mimetype='application/json')
    finally:
        if conn: conn.close()


# 7. Endpoint untuk MENGUPDATE ringkasan
@app.route("/api/sessions/<int:session_id>/summary", methods=["POST"])
def update_session_summary(session_id):
    conn = None
    try:
        data = request.json
        new_summary = data.get("summary")

        conn = get_db_connection()
        if conn is None:
            return Response(json.dumps({"error": "Koneksi DB gagal"}), status=503, mimetype='application/json')

        with conn.cursor() as cur:
            # Ganti nama tabelnya jadi 'conversation' (tanpa 's')
            cur.execute(
                "UPDATE public.conversation SET summary = %s WHERE id = %s",
                (new_summary, session_id)
            )
        
        conn.commit()
        return Response(json.dumps({"message": "Ringkasan berhasil diupdate"}), status=200, mimetype='application/json')

    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ Error di update_session_summary: {e}")
        return Response(json.dumps({"error": "Gagal update ringkasan"}), status=500, mimetype='application/json')
    finally:
        if conn: conn.close()

# 8. Endpoint untuk MENGAMBIL info SATU sesi (termasuk summary)
@app.route("/api/sessions/<int:session_id>", methods=["GET"])
def get_single_session_info(session_id):
    conn = None
    try:
        conn = get_db_connection()
        if conn is None:
            return Response(json.dumps({"error": "Koneksi DB gagal"}), status=503, mimetype='application/json')

        with conn.cursor() as cur:
            cur.execute(
                "SELECT summary FROM public.conversation WHERE id = %s",
                (session_id,)
            )
            result = cur.fetchone()
        
        if result:
            return Response(json.dumps({"summary": result[0]}), status=200, mimetype='application/json')
        else:
            return Response(json.dumps({"error": "Sesi tidak ditemukan"}), status=404, mimetype='application/json')
            
    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ Error di mengambil_session_summary: {e}")
        return Response(json.dumps({"error": "Gagal mengambil ringkasan"}), status=500, mimetype='application/json')
    finally:
        if conn: conn.close()

# ===================================================================
# === API ENDPOINTS BARU UNTUK MANIPULASI PESAN ===
# ===================================================================

# ===================================================================
# === API ENDPOINTS FINAL UNTUK MANIPULASI PESAN ===
# ===================================================================

# 9. Endpoint untuk MENGHAPUS pesan (bisa satu atau banyak)
#    Kita pake metode POST biar bisa kirim body (daftar ID)
@app.route("/api/messages/delete", methods=["POST"])
def delete_messages_unified():
    conn = None
    try:
        data = request.json
        ids_to_delete = data.get("ids") # Selalu harapkan daftar/list

        if not ids_to_delete or not isinstance(ids_to_delete, list):
            return Response(json.dumps({"error": "Daftar ID tidak valid"}), status=400, mimetype='application/json')

        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM public.message WHERE id IN %s", (tuple(ids_to_delete),))
        conn.commit()
        
        print(f"✅ Pesan dengan ID {ids_to_delete} berhasil dihapus.")
        return Response(json.dumps({"message": "Pesan berhasil dihapus"}), status=200, mimetype='application/json')
    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ Error di delete_messages_unified: {e}")
        return Response(json.dumps({"error": "Gagal hapus pesan di server"}), status=500, mimetype='application/json')
    finally:
        if conn: conn.close()


# 10. Endpoint untuk MENGUPDATE pesan (fitur Edit & Resend)
#     Ini juga akan hapus history setelahnya
@app.route("/api/messages/<int:message_id>/update", methods=["POST"])
def update_message_unified(message_id):
    conn = None
    try:
        data = request.json
        new_content = data.get("content")
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Hapus dulu semua pesan SETELAH pesan yang diedit
            cur.execute(
                "DELETE FROM public.message WHERE id > %s AND conversation_id = (SELECT conversation_id FROM public.message WHERE id = %s)",
                (message_id, message_id)
            )
            # Baru UPDATE konten pesan yang diedit
            cur.execute(
                "UPDATE public.message SET content = %s WHERE id = %s",
                (new_content, message_id)
            )
        conn.commit()
        return Response(json.dumps({"message": "Pesan berhasil diupdate dan history setelahnya dihapus"}), status=200, mimetype='application/json')
    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ Error di update_message_unified: {e}")
        return Response(json.dumps({"error": "Gagal update pesan di server"}), status=500, mimetype='application/json')
    finally:
        if conn: conn.close()

# 11. Endpoint untuk Regenerate (menghapus pesan AI terakhir)
#    Kita bisa pake ulang endpoint DELETE, tapi kita butuh cara tau ID pesan AI terakhir.
#    Untuk sekarang, kita asumsikan frontend akan mengirimkan ID pesan AI yang mau dihapus.


if __name__ == "__main__":
    print("✅ Server development diganti ke Waitress yang lebih kuat.")
    print("🚀 Server berjalan di http://127.0.0.1:5000")
    serve(app, host="0.0.0.0", port=5000)