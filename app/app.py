import os
import json
from flask import Flask, request, Response, render_template
from dotenv import load_dotenv
from flask_cors import CORS
from werkzeug.utils import secure_filename

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

# --- KONEKSI KE GEMINI ---
# try:
#     api_key = os.getenv("GEMINI_API_KEY")
#     if not api_key:
#         raise ValueError("GEMINI_API_KEY tidak ditemukan!")
#     client = genai.Client(api_key=api_key)
#     print("✅ Client Gemini 2.5 berhasil dibuat.")
# except Exception as e:
#     print(f"❌ Terjadi kesalahan saat membuat client Gemini: {e}")
#     exit()


# === FUNGSI STREAM GENERATOR (SEKARANG DI LUAR 'CHAT') ===
def stream_generator(
    image_part,
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
    try:
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
            recent_history = history[-8:]
            history_text = "\n".join(
                [f"{msg['role']}: {msg['parts'][0]}" for msg in recent_history]
            )
            history_block = f"Berikut adalah ringkasan...\n<ringkasan>\n{summary}\n</ringkasan>\n\nDan ini adalah 8 pesan terakhir...\n<chat_terbaru>\n{history_text}\n</chat_terbaru>"
        else:
            if history:
                history_text = "\n".join(
                    [f"{msg['role']}: {msg['parts'][0]}" for msg in history]
                )
                history_block = f"RIWAYAT CHAT SEBELUMNYA:\n{history_text}"

        # --- 4. Gabungkan semua blok menjadi satu prompt utuh ---
        full_prompt = (
            f"Kamu adalah sebuah karakter AI dengan peran dan instruksi sebagai berikut\n"
            f"{persona_text_block}"
            f"{user_persona_block}"
            f"{memory_block}"
            f"{world_info_block}"
            f"{npc_block}"
            f"Ikuti instruksi sistem ini, ikuti setiap instruksi dan aturan yang ditulis dan ini bersifat mutlak dan wajib untuk dipatuhi :\n<instruksi_sistem>\n{system_instruction}\n</instruksi_sistem>\n\n"
            f"Gunakan contoh dialog ini sebagai referensi gaya bicara kamu yang informal.. \n<contoh_dialog>\n{example_dialogs}\n</contoh_dialog>\n\n"
            f"---\n\n"
            f"{history_block}\n\n"
            f"INGAT: Selalu gunakan gaya bahasa yang santai dan informal sesuai <instruksi_sistem> di atas. "
            f"Jangan pernah gunakan kata 'akan' atau 'tentu saja'.\n"
            f'model: {user_name} bilang: "{user_message}". Sekarang giliranmu merespon sebagai {character_info.get("name", "karakter")}:\n'
            f"model:"
        )
        print(f"Mengirim prompt ke Gemini...")

        # --- 5. Konfigurasi dan panggil AI ---
        config = types.GenerateContentConfig(
            temperature=temperature_value,
            thinking_config=types.ThinkingConfig(include_thoughts=True),
        )
        contents_to_send = []
        if image_part:
            contents_to_send.append(image_part)  # Tambahkan gambar jika ada
        contents_to_send.append(full_prompt)  # Selalu tambahkan teks prompt

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

        except Exception as e:
            # Menangkap error lain yang mungkin terjadi selama iterasi, seperti masalah koneksi
            print(f"❌ Terjadi error DI DALAM loop streaming: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': f'Terjadi masalah saat streaming: {e}'})}\n\n"

    except Exception as e:
        print(f"❌ Error saat streaming: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': 'Error di server.'})}\n\n"


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
@app.route("/summarize", methods=["POST"])
def summarize():
    data = request.json
    history_to_summarize = data.get("history", [])
    custom_api_key = data.get("api_key", None)  # <-- TAMBAH INI
    selected_model = data.get("model", "models/gemini-2.5-flash")
    if not history_to_summarize:
        return Response(
            json.dumps({"error": "History kosong"}),
            status=400,
            mimetype="application/json",
        )
    try:
        history_text = "\n".join(
            [f"{msg['role']}: {msg['parts'][0]}" for msg in history_to_summarize]
        )
        summarization_prompt = (
            f"Kamu adalah AI ahli meringkas. Ringkaslah percakapan berikut menjadi poin-poin penting dalam bentuk paragraf singkat. "
            f"TULIS RINGKASAN MENGGUNAKAN GAYA BAHASA SANTAI DAN INFORMAL, HINDARI BAHASA BAKU. "
            f"Fokus pada kejadian dan dialog kunci.\n\n"
            f"RIWAYAT PERCAKAPAN:\n{history_text}"
        )
        api_key_to_use = custom_api_key or os.getenv("GEMINI_API_KEY")
        if not api_key_to_use:
            raise ValueError("Tidak ada API Key yang tersedia untuk meringkas.")
        client = genai.Client(api_key=api_key_to_use)
        response = client.models.generate_content(
            model=selected_model, contents=summarization_prompt
        )
        summary_text = response.text.strip()
        print(f"Ringkasan diterima: {summary_text}")
        return Response(
            json.dumps({"summary": summary_text}),
            status=200,
            mimetype="application/json",
        )
    except Exception as e:
        print(f"❌ Error saat meringkas: {e}")
        return Response(
            json.dumps({"error": f"Gagal meringkas: {e}"}),
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

    # Proses file gambar jika ada
    if "image" in request.files and request.files["image"].filename != "":
        image_file = request.files["image"]
        temp_file_path = None
        try:
            # Kita buat client di sini HANYA untuk upload file
            api_key_for_upload = custom_api_key or os.getenv("GEMINI_API_KEY")
            if not api_key_for_upload:
                raise ValueError("API Key tidak tersedia untuk upload file.")

            # Gunakan client yang sama seperti caramu
            upload_client = genai.Client(api_key=api_key_for_upload)

            filename = secure_filename(image_file.filename)
            temp_file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            image_file.save(temp_file_path)

            print(f"Mengunggah file: {temp_file_path} ke Google...")
            uploaded_file = upload_client.files.upload(
                file=temp_file_path
            )  # Bukan path=, tapi file=
            image_part = uploaded_file
            print(f"File berhasil diunggah: {uploaded_file.uri}")

        except Exception as e:
            print(f"❌ Gagal memproses gambar: {e}")
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            # Kirim pesan error ke frontend
            error_data = json.dumps(
                {"type": "error", "content": f"Gagal upload gambar: {str(e)}"}
            )
            return Response(f"data: {error_data}\n\n", mimetype="text/event-stream")
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    # Panggil stream_generator dengan semua data
    return Response(
        stream_generator(
            image_part,  # Bisa None jika tidak ada gambar, atau berisi file jika ada
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


# --- JALANKAN APLIKASI ---
# --- JALANKAN APLIKASI DENGAN WAITRESS ---


# --- JALANKAN APLIKASI ---
if __name__ == "__main__":
    app.run(debug=True, port=5000)
