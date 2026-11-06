"""Layanan analitik InsightUsaha (FastAPI).

Layanan ini stateless: Laravel mengirim file / data agregat per periode,
layanan mengembalikan hasil. Penyimpanan ke basis data dilakukan Laravel.
"""

from __future__ import annotations

import json
import os
from typing import Any

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from . import analysis, parsing

SERVICE_TOKEN = os.environ.get("ANALYTICS_TOKEN", "")
MAX_BYTES = 10 * 1024 * 1024

app = FastAPI(title="InsightUsaha Analytics", version="1.0.0")


def check_token(x_service_token: str | None = Header(default=None)) -> None:
    if SERVICE_TOKEN and x_service_token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Token layanan tidak valid.")


async def _read(file: UploadFile) -> bytes:
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=422, detail="Ukuran file melebihi 10 MB.")
    name = (file.filename or "").lower()
    if not (name.endswith(".csv") or name.endswith(".xlsx")):
        raise HTTPException(status_code=422, detail="Format file tidak didukung. Gunakan file .xlsx atau .csv.")
    return content


def _mapping(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Format pemetaan kolom tidak valid.") from exc
    return value if isinstance(value, dict) else None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/inspect", dependencies=[Depends(check_token)])
async def inspect(file: UploadFile = File(...), mapping: str | None = Form(default=None)) -> dict[str, Any]:
    content = await _read(file)
    try:
        return parsing.inspect_file(content, file.filename or "", _mapping(mapping))
    except parsing.FileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/clean", dependencies=[Depends(check_token)])
async def clean(file: UploadFile = File(...), mapping: str = Form(...)) -> dict[str, Any]:
    content = await _read(file)
    try:
        return parsing.clean_file(content, file.filename or "", _mapping(mapping) or {})
    except parsing.FileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/table", dependencies=[Depends(check_token)])
async def table(file: UploadFile = File(...)) -> dict[str, Any]:
    content = await _read(file)
    try:
        return parsing.read_simple_table(content, file.filename or "")
    except parsing.FileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


class AnalyzeRequest(BaseModel):
    jenis: list[str]
    periode: dict[str, str]
    baris: dict[str, list[Any]]
    parameter: dict[str, Any] = Field(default_factory=dict)


@app.post("/analyze", dependencies=[Depends(check_token)])
def analyze(req: AnalyzeRequest) -> dict[str, Any]:
    for key in ("mulai", "selesai", "lalu_mulai", "lalu_selesai"):
        if key not in req.periode:
            raise HTTPException(status_code=422, detail=f"Periode '{key}' wajib diisi.")
    try:
        return analysis.run(req.jenis, req.baris, req.periode, req.parameter)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
