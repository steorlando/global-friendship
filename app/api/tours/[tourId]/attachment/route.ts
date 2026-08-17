import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireTourStaffUser } from "@/lib/tours/auth";
import { loadTourSettings } from "@/lib/tours/server";
import {
  safeAttachmentFileName,
  tourApiErrorCode,
  validateTourAttachment,
} from "@/lib/tours/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BUCKET = "tour-attachments";

async function loadTour(service: ReturnType<typeof createSupabaseServiceClient>, tourId: string) {
  const { data, error } = await service
    .from("tours")
    .select("id,is_active,attachment_path,attachment_name,attachment_mime_type")
    .eq("id", tourId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tourId: string }> }
) {
  const { tourId } = await params;
  const service = createSupabaseServiceClient({ noStore: true });
  try {
    const [tour, settings] = await Promise.all([
      loadTour(service, tourId),
      loadTourSettings(service),
    ]);
    if (!tour?.attachment_path) {
      return NextResponse.json({ error: "TOUR_ATTACHMENT_NOT_FOUND" }, { status: 404 });
    }

    if (!settings.publicEnabled || !tour.is_active) {
      const auth = await requireTourStaffUser();
      if ("errorResponse" in auth) return auth.errorResponse;
    }

    const { data, error } = await service.storage.from(BUCKET).download(tour.attachment_path);
    if (error || !data) {
      return NextResponse.json({ error: "TOUR_ATTACHMENT_NOT_FOUND" }, { status: 404 });
    }
    const filename = encodeURIComponent(tour.attachment_name || "tour-attachment");
    return new NextResponse(data, {
      headers: {
        "content-type": tour.attachment_mime_type || "application/octet-stream",
        "content-disposition": `inline; filename*=UTF-8''${filename}`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to download attachment" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tourId: string }> }
) {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { tourId } = await params;
  const service = createSupabaseServiceClient({ noStore: true });

  try {
    const tour = await loadTour(service, tourId);
    if (!tour) return NextResponse.json({ error: "TOUR_NOT_FOUND" }, { status: 404 });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("TOUR_ATTACHMENT_NAME_REQUIRED");
    validateTourAttachment(file);

    const filename = safeAttachmentFileName(file.name);
    const path = `${tourId}/${crypto.randomUUID()}-${filename}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await service.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) throw new Error(uploadError.message);

    const { error: updateError } = await service
      .from("tours")
      .update({
        attachment_path: path,
        attachment_name: file.name.slice(0, 255),
        attachment_mime_type: file.type,
        attachment_size_bytes: file.size,
        updated_by: auth.user.id,
      })
      .eq("id", tourId);
    if (updateError) {
      await service.storage.from(BUCKET).remove([path]);
      throw new Error(updateError.message);
    }
    if (tour.attachment_path) {
      await service.storage.from(BUCKET).remove([tour.attachment_path]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: tourApiErrorCode(error) }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tourId: string }> }
) {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { tourId } = await params;
  const service = createSupabaseServiceClient({ noStore: true });

  try {
    const tour = await loadTour(service, tourId);
    if (!tour) return NextResponse.json({ error: "TOUR_NOT_FOUND" }, { status: 404 });
    const { error } = await service
      .from("tours")
      .update({
        attachment_path: null,
        attachment_name: null,
        attachment_mime_type: null,
        attachment_size_bytes: null,
        updated_by: auth.user.id,
      })
      .eq("id", tourId);
    if (error) throw new Error(error.message);
    if (tour.attachment_path) {
      await service.storage.from(BUCKET).remove([tour.attachment_path]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove attachment" },
      { status: 400 }
    );
  }
}
