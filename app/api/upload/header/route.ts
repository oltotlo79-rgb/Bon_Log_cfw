import { NextRequest } from 'next/server'
import { handleProfileImageUpload } from '@/app/api/upload/_shared/profile-image-upload'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return handleProfileImageUpload(request, 'header')
}
