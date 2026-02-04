"""
Email Parser API
FastAPI приложение для извлечения и валидации email адресов
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict
import os
from pathlib import Path
import logging
import time

from modules.email_extractor import EmailExtractor
from modules.email_validator import EmailValidator

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Создать FastAPI приложение
app = FastAPI(
    title="Email Parser API",
    description="API для извлечения и валидации email адресов",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализация модулей
extractor = EmailExtractor()
validator = EmailValidator()

# Директории
BASE_DIR = Path(__file__).parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


# ==================== Pydantic Models ====================

class ExtractTextRequest(BaseModel):
    """Запрос на извлечение email из текста"""
    text: str = Field(..., min_length=1, description="Текст для поиска")
    strict: bool = Field(False, description="Строгая валидация")


class ExtractURLRequest(BaseModel):
    """Запрос на извлечение email с URL"""
    url: str = Field(..., min_length=1, description="URL страницы")
    deep_crawl: bool = Field(False, description="Глубокое сканирование")
    max_depth: int = Field(2, ge=1, le=5, description="Максимальная глубина")


class ValidateEmailRequest(BaseModel):
    """Запрос на валидацию email"""
    email: str = Field(..., min_length=1, description="Email адрес")
    check_mx: bool = Field(True, description="Проверить MX записи")
    check_disposable: bool = Field(True, description="Проверить одноразовые email")

    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        if '@' not in v:
            raise ValueError('Invalid email format')
        return v.strip().lower()


class ValidateBulkRequest(BaseModel):
    """Запрос на пакетную валидацию"""
    emails: List[str] = Field(..., min_items=1, max_items=100)
    check_mx: bool = Field(True, description="Проверить MX записи")
    check_disposable: bool = Field(True, description="Проверить одноразовые email")


class ExtractBulkRequest(BaseModel):
    """Запрос на пакетное извлечение"""
    sources: List[Dict[str, str]] = Field(..., min_items=1, max_items=50)


# ==================== Routes ====================

@app.get("/", response_class=HTMLResponse)
async def root():
    """Главная страница"""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return HTMLResponse("""
        <h1>Email Parser API</h1>
        <p>API работает!</p>
        <ul>
            <li><a href="/docs">API Documentation (Swagger)</a></li>
            <li><a href="/redoc">API Documentation (ReDoc)</a></li>
            <li><a href="/health">Health Check</a></li>
        </ul>
    """)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "email-parser-api",
        "version": "1.0.0",
        "modules": {
            "extractor": "operational",
            "validator": "operational"
        }
    }


# ==================== Extraction Endpoints ====================

@app.post("/api/extract/text")
async def extract_from_text(request: ExtractTextRequest):
    """Извлечь email адреса из текста"""
    try:
        start_time = time.time()

        emails = extractor.extract_from_text(
            request.text,
            strict=request.strict
        )

        processing_time = round(time.time() - start_time, 3)

        return {
            "success": True,
            "emails": emails,
            "count": len(emails),
            "processing_time": processing_time
        }

    except Exception as e:
        logger.error(f"Error extracting from text: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/extract/url")
async def extract_from_url(request: ExtractURLRequest):
    """Извлечь email адреса с веб-страницы"""
    try:
        start_time = time.time()

        result = await extractor.extract_from_url(
            request.url,
            deep_crawl=request.deep_crawl,
            max_depth=request.max_depth
        )

        processing_time = round(time.time() - start_time, 3)
        result['processing_time'] = processing_time

        if not result.get('success'):
            raise HTTPException(
                status_code=400,
                detail=result.get('error', 'Failed to extract emails')
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting from URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/extract/file")
async def extract_from_file(file: UploadFile = File(...)):
    """Извлечь email адреса из загруженного файла"""
    try:
        start_time = time.time()

        # Сохранить файл
        file_path = UPLOADS_DIR / file.filename
        content = await file.read()

        with open(file_path, 'wb') as f:
            f.write(content)

        # Извлечь email
        result = await extractor.extract_from_file(str(file_path))

        # Удалить файл после обработки
        try:
            file_path.unlink()
        except:
            pass

        processing_time = round(time.time() - start_time, 3)
        result['processing_time'] = processing_time

        if not result.get('success'):
            raise HTTPException(
                status_code=400,
                detail=result.get('error', 'Failed to extract emails')
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting from file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/extract/bulk")
async def extract_bulk(request: ExtractBulkRequest):
    """Пакетное извлечение email из множества источников"""
    try:
        start_time = time.time()

        result = await extractor.extract_bulk(request.sources)

        processing_time = round(time.time() - start_time, 3)
        result['processing_time'] = processing_time

        return result

    except Exception as e:
        logger.error(f"Error in bulk extraction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Validation Endpoints ====================

@app.post("/api/validate/email")
async def validate_email(request: ValidateEmailRequest):
    """Валидировать email адрес"""
    try:
        start_time = time.time()

        result = await validator.validate_email(
            request.email,
            check_mx=request.check_mx,
            check_disposable=request.check_disposable
        )

        processing_time = round(time.time() - start_time, 3)
        result['processing_time'] = processing_time

        return result

    except Exception as e:
        logger.error(f"Error validating email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/validate/bulk")
async def validate_bulk(request: ValidateBulkRequest):
    """Пакетная валидация множества email адресов"""
    try:
        start_time = time.time()

        result = await validator.validate_bulk(
            request.emails,
            check_mx=request.check_mx,
            check_disposable=request.check_disposable
        )

        processing_time = round(time.time() - start_time, 3)
        result['processing_time'] = processing_time

        return result

    except Exception as e:
        logger.error(f"Error in bulk validation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Combined Endpoint ====================

@app.post("/api/parse")
async def parse_and_validate(
    text: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    validate: bool = Form(True),
    check_mx: bool = Form(True),
    check_disposable: bool = Form(True)
):
    """
    Комбинированный endpoint: извлечь И валидировать email
    """
    try:
        start_time = time.time()

        emails = []

        # Извлечь email из источника
        if text:
            emails = extractor.extract_from_text(text)
        elif url:
            result = await extractor.extract_from_url(url)
            if result.get('success'):
                emails = result.get('emails', [])
        elif file:
            file_path = UPLOADS_DIR / file.filename
            content = await file.read()
            with open(file_path, 'wb') as f:
                f.write(content)

            result = await extractor.extract_from_file(str(file_path))
            try:
                file_path.unlink()
            except:
                pass

            if result.get('success'):
                emails = result.get('emails', [])
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide text, url, or file"
            )

        result = {
            "success": True,
            "emails_found": len(emails),
            "emails": emails
        }

        # Валидировать если нужно
        if validate and emails:
            validation_result = await validator.validate_bulk(
                emails,
                check_mx=check_mx,
                check_disposable=check_disposable
            )

            result['validation'] = validation_result

        processing_time = round(time.time() - start_time, 3)
        result['processing_time'] = processing_time

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in parse endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Cleanup ====================

@app.on_event("shutdown")
async def shutdown_event():
    """Закрыть соединения при выключении"""
    await extractor.close()
    logger.info("Application shutdown")


# Подключить frontend статику
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )
