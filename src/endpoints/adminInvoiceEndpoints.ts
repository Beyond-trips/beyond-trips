// New file: src/endpoints/adminInvoiceEndpoints.ts
import type { PayloadRequest } from 'payload'
import { checkAdminAccess, parseRequestBody } from '../utilities/requestHelpers'
import { sendInvoiceNotification } from '../services/notifications/advertiserNotifications'

// Get all invoices
export const getAllInvoices = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const statusFilter = searchParams.get('status') || ''
    const paymentStatusFilter = searchParams.get('paymentStatus') || ''
    const search = searchParams.get('search') || ''

    console.log(`💳 Admin fetching invoices. Status: ${statusFilter}, Payment Status: ${paymentStatusFilter}`)

    const whereClause: any = {}
    if (statusFilter) {
      whereClause.status = { equals: statusFilter }
    }
    if (paymentStatusFilter) {
      whereClause.paymentStatus = { equals: paymentStatusFilter }
    }

    if (search) {
      whereClause.or = [
        { invoiceNumber: { contains: search } },
        { stripePaymentIntentId: { contains: search } }
      ]
    }

    const invoices = await req.payload.find({
      collection: 'invoices',
      where: whereClause,
      sort: '-createdAt',
      page,
      limit,
      depth: 2 // Populate business and campaign details
    })

    return new Response(JSON.stringify({
      success: true,
      ...invoices,
      docs: invoices.docs.map((invoice: any) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        paymentMethod: invoice.paymentMethod,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        createdAt: invoice.createdAt,
        business: {
          id: invoice.businessId?.id,
          name: invoice.businessId?.businessName,
          email: invoice.businessId?.businessEmail
        },
        campaign: {
          id: invoice.campaignId?.id,
          name: invoice.campaignId?.campaignName,
          status: invoice.campaignId?.status
        }
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get all invoices error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get invoices',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Manually confirm offline invoice payment
export const confirmOfflinePayment = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { invoiceId, paymentMethod, transactionReference, notes } = body

    if (!invoiceId || !paymentMethod) {
      return new Response(JSON.stringify({
        error: 'Invoice ID and payment method are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`💳 Admin confirming offline payment for invoice: ${invoiceId}`)

    // Get the invoice
    const invoice = await req.payload.findByID({
      collection: 'invoices',
      id: invoiceId
    })

    if (!invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // Check if invoice is already paid
    if ((invoice as any).status === 'paid') {
      return new Response(JSON.stringify({
        error: 'Invoice has already been marked as paid'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update invoice to paid
    const updatedInvoice = await req.payload.update({
      collection: 'invoices',
      id: invoiceId,
      data: {
        status: 'paid',
        paymentStatus: 'succeeded',
        paymentMethod: paymentMethod, // e.g., 'bank_transfer', 'cash'
        paidAt: new Date().toISOString(),
        notes: notes ? `${(invoice as any).notes || ''}\n[Admin Confirmation] ${notes}` : (invoice as any).notes,
        // Store transaction reference in notes if provided
        stripePaymentIntentId: transactionReference || (invoice as any).stripePaymentIntentId
      }
    })

    // Send payment confirmation notification to advertiser
    const businessId = typeof (invoice as any).businessId === 'object' 
      ? (invoice as any).businessId.id 
      : (invoice as any).businessId
    
    if (businessId) {
      try {
        await sendInvoiceNotification(
          req.payload,
          businessId,
          'payment',
          invoiceId,
          (invoice as any).invoiceNumber || invoiceId,
          (invoice as any).totalAmount
        )
      } catch (notifError) {
        console.warn('⚠️ Failed to send payment confirmation notification:', notifError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Offline payment confirmed successfully',
      invoice: {
        id: updatedInvoice.id,
        invoiceNumber: (updatedInvoice as any).invoiceNumber,
        status: (updatedInvoice as any).status,
        paymentStatus: (updatedInvoice as any).paymentStatus,
        paidAt: (updatedInvoice as any).paidAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Confirm offline payment error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to confirm offline payment',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Export invoices to CSV
export const exportInvoicesToCSV = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const status = searchParams.get('status') || 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    console.log('📊 Admin exporting invoices to CSV:', { status, startDate, endDate })

    const whereClause: any = {}
    if (status !== 'all') {
      whereClause.status = { equals: status }
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.greater_than_equal = new Date(startDate).toISOString()
      }
      if (endDate) {
        whereClause.createdAt.less_than_equal = new Date(endDate).toISOString()
      }
    }

    const invoices = await req.payload.find({
      collection: 'invoices',
      where: whereClause,
      sort: '-createdAt',
      limit: 10000, // Export up to 10,000 records
      depth: 2
    })

    // Generate CSV
    const headers = [
      'Invoice Number',
      'Business Name',
      'Business Email',
      'Campaign Name',
      'Amount',
      'Total Amount',
      'Currency',
      'Status',
      'Payment Status',
      'Payment Method',
      'Due Date',
      'Paid At',
      'Created At',
      'Stripe Payment Intent ID',
      'Notes'
    ]

    const rows = invoices.docs.map((invoice: any) => {
      const business = invoice.businessId
      const campaign = invoice.campaignId
      
      return [
        invoice.invoiceNumber,
        business?.businessName || 'N/A',
        business?.businessEmail || 'N/A',
        campaign?.campaignName || 'N/A',
        invoice.amount,
        invoice.totalAmount,
        invoice.currency || 'NGN',
        invoice.status,
        invoice.paymentStatus || 'N/A',
        invoice.paymentMethod || 'N/A',
        invoice.dueDate ? new Date(invoice.dueDate).toISOString() : 'N/A',
        invoice.paidAt ? new Date(invoice.paidAt).toISOString() : 'N/A',
        new Date(invoice.createdAt).toISOString(),
        invoice.stripePaymentIntentId || 'N/A',
        invoice.notes || 'N/A'
      ]
    })

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="invoices_${status}_${new Date().toISOString().split('T')[0]}.csv"`
      }
    })

  } catch (error: any) {
    console.error('❌ Export invoices to CSV error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export invoices',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Export invoices to PDF (structured data for frontend PDF generation)
export const exportInvoicesToPDF = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const status = searchParams.get('status') || 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    console.log('📊 Admin exporting invoices for PDF:', { status, startDate, endDate })

    const whereClause: any = {}
    if (status !== 'all') {
      whereClause.status = { equals: status }
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.greater_than_equal = new Date(startDate).toISOString()
      }
      if (endDate) {
        whereClause.createdAt.less_than_equal = new Date(endDate).toISOString()
      }
    }

    const invoices = await req.payload.find({
      collection: 'invoices',
      where: whereClause,
      sort: '-createdAt',
      limit: 10000, // Export up to 10,000 records
      depth: 2
    })

    // Calculate totals
    const totalAmount = invoices.docs.reduce((sum: number, inv: any) => sum + inv.totalAmount, 0)
    const paidAmount = invoices.docs
      .filter((inv: any) => inv.status === 'paid')
      .reduce((sum: number, inv: any) => sum + inv.totalAmount, 0)
    const pendingAmount = invoices.docs
      .filter((inv: any) => inv.status === 'pending_payment')
      .reduce((sum: number, inv: any) => sum + inv.totalAmount, 0)

    // Return structured data for PDF generation
    return new Response(JSON.stringify({
      success: true,
      exportData: {
        generatedAt: new Date().toISOString(),
        generatedBy: user.email,
        filters: { status, startDate, endDate },
        summary: {
          totalRecords: invoices.docs.length,
          totalAmount,
          paidAmount,
          pendingAmount,
          currency: 'NGN'
        },
        invoices: invoices.docs.map((invoice: any) => {
          const business = invoice.businessId
          const campaign = invoice.campaignId
          
          return {
            invoiceNumber: invoice.invoiceNumber,
            businessName: business?.businessName || 'N/A',
            businessEmail: business?.businessEmail || 'N/A',
            campaignName: campaign?.campaignName || 'N/A',
            amount: invoice.amount,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency || 'NGN',
            status: invoice.status,
            paymentStatus: invoice.paymentStatus,
            paymentMethod: invoice.paymentMethod,
            dueDate: invoice.dueDate,
            paidAt: invoice.paidAt,
            createdAt: invoice.createdAt,
            items: invoice.items || []
          }
        })
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Export invoices for PDF error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export invoices',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

