import json
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from app.api.middleware.auth import verify_service_key
from app.config import get_settings
from app.dependencies import llm_client

logger = logging.getLogger(__name__)
router = APIRouter()

_SYSTEM_PROMPT = """You are an AI meeting summarizer and action-item extractor for Mongez.
Read the meeting transcript provided, summarize the key points, and extract specific tasks/action items mentioned.

For each action item, try to identify:
1. A clear, actionable title.
2. A detailed description.
3. The email of the assignee if explicitly mentioned or if their email can be inferred, otherwise null.
4. An estimated due date in YYYY-MM-DD format if mentioned, otherwise null.

Output ONLY a valid JSON object matching this schema:
{
  "title": "<Concise Meeting Title>",
  "description": "<One or two paragraph summary of the meeting>",
  "topics": ["<key topic 1>", "<key topic 2>", ...],
  "action_items": [
    {
      "title": "<Task title>",
      "description": "<Task description and details>",
      "assignee_email": "<assignee_email@example.com>" | null,
      "due_date": "YYYY-MM-DD" | null
    }
  ]
}

Rules:
- Do not add any text before or after the JSON.
- If no action items were found, leave the action_items array empty.
- Ensure all emails and dates are in valid formats.
"""


@router.post("/analyze")
async def analyze_meeting(
    file: UploadFile = File(...),
    _: str = Depends(verify_service_key),
):
    """Transcribes meeting audio using Groq Whisper, then summarizes and extracts action items."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise HTTPException(status_code=500, detail="Groq API Key is not configured on the AI service.")

    # 1. Transcribe the audio file using Groq Whisper API
    logger.info("Transcribing audio file %s using Groq Whisper...", file.filename)
    try:
        file_bytes = await file.read()
        
        async with httpx.AsyncClient() as client:
            files = {
                "file": (file.filename, file_bytes, file.content_type)
            }
            data = {
                "model": "whisper-large-v3",
                "response_format": "json"
            }
            headers = {
                "Authorization": f"Bearer {settings.groq_api_key}"
            }
            
            resp = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                files=files,
                data=data,
                headers=headers,
                timeout=120.0
            )
            resp.raise_for_status()
            transcript_text = resp.json().get("text", "")
    except Exception as exc:
        logger.error("Failed to transcribe audio file: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Audio transcription failed. Please try again."
        )

    if not transcript_text.strip():
        raise HTTPException(
            status_code=400,
            detail="The audio file could not be transcribed or resulted in an empty transcript."
        )

    # 2. Summarize and extract action items using Groq LLM
    logger.info("Summarizing transcript and extracting action items...")
    try:
        result = await llm_client.invoke("primary", _SYSTEM_PROMPT, f"Transcript:\n{transcript_text}")
        content = result["content"].strip()

        # Clean potential markdown wrapping if present
        clean_content = content
        if clean_content.startswith("```json"):
            clean_content = clean_content.split("```json", 1)[1]
        if clean_content.endswith("```"):
            clean_content = clean_content.rsplit("```", 1)[0]

        summary_json = json.loads(clean_content.strip(), strict=False)
    except Exception as exc:
        logger.error("Failed to summarize transcript: %s. Response content: %s", exc, content)
        # Return a fallback JSON structure if parsing fails
        summary_json = {
            "title": file.filename.rsplit(".", 1)[0],
            "description": "Failed to parse AI summary. Please check the raw transcript.",
            "topics": [],
            "action_items": []
        }

    return {
        "transcript": transcript_text,
        "summary": summary_json
    }
