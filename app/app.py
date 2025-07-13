import os
import json
from flask import Flask, request, Response
from dotenv import load_dotenv
from flask_cors import CORS


try:
    from google import genai
    from google.genai import types
except ModuleNotFoundError:
    print("KESALAHAN: Library 'google-genai' tidak ditemukan.")
    exit()

# --- SETUP DASAR ---
load_dotenv()
app = Flask(__name__)
CORS(app)

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
            memory_block = f"Ini berisi alur cerita atau moment penting...\n<memori_penting>\n{formatted_memories}\n</memori_penting>\n\n"
        world_info_block = ""
        if world_info_entries:
            formatted_world_infos = "\n".join(
                [f"- {entry}" for entry in world_info_entries]
            )
            world_info_block = f"Berikut adalah informasi, lore, dan konteks tentang dunia...\n<info_dunia>\n{formatted_world_infos}\n</info_dunia>\n\n"
        npc_block = ""
        if npc_entries:
            formatted_npcs = "\n\n---\n\n".join(npc_entries)
            npc_block = f"Berikut adalah deskripsi karakter sampingan (NPC)...\n<karakter_sampingan>\n{formatted_npcs}\n</karakter_sampingan>\n\n"
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
            f"Kamu adalah sebuah karakter AI...\n"
            f"{persona_text_block}"
            f"{user_persona_block}"
            f"{memory_block}"
            f"{world_info_block}"
            f"{npc_block}"
            f"Ikuti instruksi sistem ini...\n<instruksi_sistem>\n{system_instruction}\n</instruksi_sistem>\n\n"
            f"Gunakan contoh dialog ini...\n<contoh_dialog>\n{example_dialogs}\n</contoh_dialog>\n\n"
            f"---\n\n"
            f"{history_block}\n\n"
            f"INGAT: Selalu gunakan gaya bahasa yang santai...\n"
            f'model: {user_name} bilang: "{user_message}". Sekarang giliranmu merespon...\n'
            f"model:"
        )
        print(f"Mengirim prompt ke Gemini...")

        # --- 5. Konfigurasi dan panggil AI ---
        config = types.GenerateContentConfig(
            temperature=temperature_value,
            thinking_config=types.ThinkingConfig(include_thoughts=True),
        )
        response_stream = client.models.generate_content_stream(
            model=selected_model,  # Gunakan model yang dipilih
            contents=full_prompt,
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


# === ENDPOINT UNTUK SUMMARIZE ===
@app.route("/summarize", methods=["POST"])
def summarize():
    data = request.json
    history_to_summarize = data.get("history", [])
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
        api_key_to_use = os.getenv(
            "GEMINI_API_KEY"
        )  # Summarize selalu pakai key dari .env
        client = genai.Client(api_key=api_key_to_use)
        response = client.models.generate_content(
            model="models/gemini-2.5-flash", contents=summarization_prompt
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
@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    # 1. Ambil semua data dari request
    history = data.get("history", [])
    user_message = data.get("message")
    character_info = data.get("character", {})
    user_info = data.get("user", {})
    memory_entries = data.get("memory", [])
    world_info_entries = data.get("world_info", [])
    npc_entries = data.get("npcs", [])
    summary = data.get("summary", "")
    selected_model = data.get("model", "models/gemini-2.5-flash")  # Ambil model
    custom_api_key = data.get("api_key", None)

    # 2. Validasi pesan
    if not user_message:
        return Response(
            json.dumps({"error": "Pesan tidak boleh kosong"}),
            status=400,
            mimetype="application/json",
        )

    # 3. Panggil stream_generator dengan semua data
    return Response(
        stream_generator(
            history,
            user_message,
            character_info,
            user_info,
            memory_entries,
            world_info_entries,
            npc_entries,
            summary,
            selected_model,  # Kirim model
            custom_api_key,
        ),
        mimetype="text/event-stream",
    )


# --- JALANKAN APLIKASI ---
if __name__ == "__main__":
    app.run(debug=True, port=5000)
