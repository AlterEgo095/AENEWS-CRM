import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eventBus } from '@/lib/event-bus';

// Default tenant used until multi-tenant auth is wired
const DEFAULT_TENANT_ID = 'default';

// ============================================================
// GET /api/crm/contacts
// List contacts with search, filter, sort, pagination
// Query params: q, status, sort, order, page, limit
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { tenantId: DEFAULT_TENANT_ID };

    if (status) {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
        { company: { contains: q } },
        { title: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    // Build orderBy
    const allowedSortFields = [
      'firstName',
      'lastName',
      'email',
      'company',
      'status',
      'createdAt',
      'updatedAt',
    ];
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';
    const orderBy = { [sortField]: order === 'asc' ? 'asc' : 'desc' };

    const [contacts, total] = await Promise.all([
      db.crmContact.findMany({
        where,
        orderBy,
        take: limit,
        skip,
      }),
      db.crmContact.count({ where }),
    ]);

    return NextResponse.json({
      contacts: contacts.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        company: c.company,
        title: c.title,
        status: c.status,
        tags: (() => { try { return JSON.parse(c.tags); } catch { return []; } })(),
        notes: c.notes,
        source: c.source,
        metadata: (() => { try { return JSON.parse(c.metadata); } catch { return {}; } })(),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error('[GET /api/crm/contacts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 },
    );
  }
}

// ============================================================
// POST /api/crm/contacts
// Create a new contact
// Body: firstName (required), lastName (required), other fields optional
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, company, title, status, tags, notes, source } = body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: 'firstName and lastName are required' },
        { status: 400 },
      );
    }

    const contact = await db.crmContact.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        title: title?.trim() || null,
        status: status || 'active',
        tags: tags ? JSON.stringify(tags) : '[]',
        notes: notes?.trim() || null,
        source: source || 'manual',
        metadata: '{}',
      },
    });

    // Emit event
    await eventBus.emit('contact.created', {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      company: contact.company,
      source: contact.source,
    });

    return NextResponse.json(
      {
        contact: {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          title: contact.title,
          status: contact.status,
          tags: (() => { try { return JSON.parse(contact.tags); } catch { return []; } })(),
          notes: contact.notes,
          source: contact.source,
          metadata: (() => { try { return JSON.parse(contact.metadata); } catch { return {}; } })(),
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/crm/contacts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 },
    );
  }
}

// ============================================================
// PUT /api/crm/contacts
// Update a contact
// Body: id (required), fields to update
// ============================================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Contact id is required' },
        { status: 400 },
      );
    }

    // Check existence
    const existing = await db.crmContact.findUnique({
      where: { id, tenantId: DEFAULT_TENANT_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (fields.firstName !== undefined) updateData.firstName = fields.firstName.trim();
    if (fields.lastName !== undefined) updateData.lastName = fields.lastName.trim();
    if (fields.email !== undefined) updateData.email = fields.email?.trim() || null;
    if (fields.phone !== undefined) updateData.phone = fields.phone?.trim() || null;
    if (fields.company !== undefined) updateData.company = fields.company?.trim() || null;
    if (fields.title !== undefined) updateData.title = fields.title?.trim() || null;
    if (fields.status !== undefined) updateData.status = fields.status;
    if (fields.tags !== undefined) updateData.tags = JSON.stringify(fields.tags);
    if (fields.notes !== undefined) updateData.notes = fields.notes?.trim() || null;
    if (fields.source !== undefined) updateData.source = fields.source;
    if (fields.metadata !== undefined) updateData.metadata = JSON.stringify(fields.metadata);

    const contact = await db.crmContact.update({
      where: { id },
      data: updateData,
    });

    // Emit event
    await eventBus.emit('contact.updated', {
      id: contact.id,
      changes: Object.keys(updateData),
    });

    return NextResponse.json({
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        title: contact.title,
        status: contact.status,
        tags: (() => { try { return JSON.parse(contact.tags); } catch { return []; } })(),
        notes: contact.notes,
        source: contact.source,
        metadata: (() => { try { return JSON.parse(contact.metadata); } catch { return {}; } })(),
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      },
    });
  } catch (error) {
    console.error('[PUT /api/crm/contacts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 },
    );
  }
}

// ============================================================
// DELETE /api/crm/contacts
// Delete a contact
// Body: id (required)
// ============================================================
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Contact id is required' },
        { status: 400 },
      );
    }

    // Check existence
    const existing = await db.crmContact.findUnique({
      where: { id, tenantId: DEFAULT_TENANT_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 },
      );
    }

    await db.crmContact.delete({
      where: { id },
    });

    // Emit event
    await eventBus.emit('contact.deleted', {
      id: existing.id,
      firstName: existing.firstName,
      lastName: existing.lastName,
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('[DELETE /api/crm/contacts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 },
    );
  }
}
