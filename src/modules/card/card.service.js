import CardPlan from './cardPlan.model.js';
import Customer from '../customer/customer.model.js';
import User from '../user/user.model.js';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';
import receiptService from '../receipt/receipt.service.js';
import Payment from '../payment/payment.model.js';
import paymentService from '../payment/payment.service.js';
import customerService from '../customer/customer.service.js';
import { generateUniqueCardNumber, resolveCardNumber } from './cardNumber.helper.js';

class CardService {
  /**
   * Create a new Card Plan (Super Admin only)
   */
  async createCardPlan(planData, creatorId) {
    const existing = await CardPlan.findOne({ name: planData.name.trim() });
    if (existing) {
      const err = new Error('A card plan with this name already exists');
      err.statusCode = 400;
      throw err;
    }

    const cardPlan = new CardPlan({
      ...planData,
      createdBy: creatorId
    });

    return await cardPlan.save();
  }

  /**
   * Update an existing Card Plan (Super Admin only)
   */
  async updateCardPlan(planId, updateData) {
    const cardPlan = await CardPlan.findById(planId);
    if (!cardPlan) {
      const err = new Error('Card plan not found');
      err.statusCode = 404;
      throw err;
    }

    if (updateData.name && updateData.name.trim() !== cardPlan.name) {
      const existing = await CardPlan.findOne({ name: updateData.name.trim() });
      if (existing) {
        const err = new Error('A card plan with this name already exists');
        err.statusCode = 400;
        throw err;
      }
    }

    Object.assign(cardPlan, updateData);
    await cardPlan.save();

    return cardPlan;
  }

  /**
   * Delete a Card Plan (Super Admin only)
   */
  async deleteCardPlan(planId) {
    const cardPlan = await CardPlan.findById(planId);
    if (!cardPlan) {
      const err = new Error('Card plan not found');
      err.statusCode = 404;
      throw err;
    }

    await CardPlan.findByIdAndDelete(planId);
    return { success: true, message: 'Card plan deleted successfully' };
  }

  /**
   * Toggle Card Plan status (Super Admin only)
   */
  async togglePlanStatus(planId, isActive) {
    const cardPlan = await CardPlan.findById(planId);
    if (!cardPlan) {
      const err = new Error('Card plan not found');
      err.statusCode = 404;
      throw err;
    }

    cardPlan.isActive = isActive !== undefined ? isActive : !cardPlan.isActive;
    await cardPlan.save();

    return cardPlan;
  }

  /**
   * Get single Card Plan by ID (Public)
   */
  async getCardPlanById(planId) {
    const cardPlan = await CardPlan.findById(planId).populate(
      'createdBy',
      'firstName lastName email role'
    );
    if (!cardPlan) {
      const err = new Error('Card plan not found');
      err.statusCode = 404;
      throw err;
    }
    return cardPlan;
  }

  /**
   * List all Card Plans (Public for landing page)
   */
  async getAllCardPlans({
    isActive,
    planType,
    search,
    page = 1,
    limit = 20,
    sortBy = 'price',
    sortOrder = 'asc'
  } = {}) {
    const filter = {};

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (planType) {
      filter.planType = planType.toUpperCase();
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { benefits: { $elemMatch: { $regex: search, $options: 'i' } } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    const sortObj = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [plans, total] = await Promise.all([
      CardPlan.find(filter)
        .populate('createdBy', 'firstName lastName email role')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      CardPlan.countDocuments(filter)
    ]);

    return {
      plans,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * Customer purchases a Card Plan
   */
  async purchaseCard({ customerUserId, cardPlanId, paymentMethod = 'ONLINE' }) {
    const user = await User.findById(customerUserId);
    if (!user) {
      const err = new Error('Customer user not found');
      err.statusCode = 404;
      throw err;
    }

    let customerProfile = await Customer.findOne({ user: customerUserId });
    if (!customerProfile) {
      customerProfile = new Customer({
        user: customerUserId,
        customerCode: `CUST-${Date.now().toString().slice(-6)}`
      });
      await customerProfile.save();
    }

    const plan = await CardPlan.findById(cardPlanId);
    if (!plan || !plan.isActive) {
      const err = new Error('Selected card plan is invalid or inactive');
      err.statusCode = 400;
      throw err;
    }

    // Check if customer already has an active card
    if (customerProfile?.activeCard?.expiresAt && new Date() >= new Date(customerProfile.activeCard.expiresAt)) {
      customerProfile.activeCard.status = 'EXPIRED';
      customerProfile.hasCard = false;
      await customerProfile.save();
    }

    const hasActiveCard =
      customerProfile?.hasCard &&
      customerProfile?.activeCard &&
      ['ACTIVE', 'SUCCESS'].includes(customerProfile.activeCard.status) &&
      (!customerProfile.activeCard.expiresAt || new Date() < new Date(customerProfile.activeCard.expiresAt));

    if (hasActiveCard) {
      const err = new Error(
        'You already have an active Health Card membership. You cannot purchase a new card while your current pass is active.'
      );
      err.statusCode = 400;
      throw err;
    }

    const purchasedAt = new Date();
    const expiresAt = new Date(purchasedAt.getTime() + plan.validityInDays * 24 * 60 * 60 * 1000);
    const cardNumber = await generateUniqueCardNumber(plan.planType);

    const activeCardData = {
      cardPlan: plan._id,
      planName: plan.name,
      planType: plan.planType,
      cardNumber,
      price: plan.price,
      purchasedAt,
      expiresAt,
      status: 'ACTIVE'
    };

    customerProfile.hasCard = true;
    customerProfile.activeCard = activeCardData;

    customerProfile.cardHistory.push({
      cardPlan: plan._id,
      planName: plan.name,
      planType: plan.planType,
      cardNumber,
      price: plan.price,
      purchasedAt,
      expiresAt,
      assignedBy: customerUserId,
      paymentStatus: 'COMPLETED'
    });

    await customerProfile.save();

    // Ensure User profile and profileModel are linked
    if (!user.profile || user.profileModel !== PROFILE_MODELS.CUSTOMER) {
      user.profile = customerProfile._id;
      user.profileModel = PROFILE_MODELS.CUSTOMER;
      await user.save();
    }

    // Send receipt email with PDF attachment asynchronously
    receiptService.sendReceiptEmailForCard(customerUserId).catch((emailErr) => {
      console.error(`[CardService] Background receipt email failed for customer ${customerUserId}:`, emailErr.message);
    });

    return {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber
      },
      activeCard: customerProfile.activeCard,
      planBenefits: plan.benefits,
      discountPercentage: plan.discountPercentage
    };
  }

  /**
   * Staff (Super Admin, Manager, Employee) assigns a card to a customer face-to-face.
   * Supports:
   * 1. CASH: Immediate offline payment confirmation without gateway. Activates card and records PAID cash payment.
   * 2. ONLINE / UPI / CARD: Initiates Cashfree payment gateway order with the price of the card.
   */
  async assignCardToCustomer({
    targetCustomerUserId,
    cardPlanId,
    assignedById,
    requestingUser = null,
    paymentMethod = 'CASH',
    paymentStatus = 'COMPLETED',
    returnUrl,
    notes = '',
    cardNumber = '',
    manualCardNumber = '',
    cardNumberSuffix = ''
  }) {
    // Role-based customer ownership check
    const staffUser = requestingUser || (await User.findById(assignedById));
    if (staffUser && staffUser.role !== ROLES.SUPER_ADMIN) {
      await customerService.verifyCustomerAccess(targetCustomerUserId, staffUser, 'assign cards to');
    }

    const user = await User.findById(targetCustomerUserId);
    if (!user || user.role !== ROLES.CUSTOMER) {
      const err = new Error('Target customer user not found');
      err.statusCode = 404;
      throw err;
    }

    let customerProfile = await Customer.findOne({ user: targetCustomerUserId });
    if (!customerProfile) {
      customerProfile = new Customer({
        user: targetCustomerUserId,
        customerCode: `CUST-${Date.now().toString().slice(-6)}`
      });
      await customerProfile.save();
    }

    const plan = await CardPlan.findById(cardPlanId);
    if (!plan) {
      const err = new Error('Selected card plan not found');
      err.statusCode = 404;
      throw err;
    }
    if (!plan.isActive) {
      const err = new Error('Selected card plan is currently inactive');
      err.statusCode = 400;
      throw err;
    }

    // Check if customer already has an active card
    if (customerProfile?.activeCard?.expiresAt && new Date() >= new Date(customerProfile.activeCard.expiresAt)) {
      customerProfile.activeCard.status = 'EXPIRED';
      customerProfile.hasCard = false;
      await customerProfile.save();
    }

    const hasActiveCard =
      customerProfile?.hasCard &&
      customerProfile?.activeCard &&
      ['ACTIVE', 'SUCCESS'].includes(customerProfile.activeCard.status) &&
      (!customerProfile.activeCard.expiresAt || new Date() < new Date(customerProfile.activeCard.expiresAt));

    if (hasActiveCard) {
      const err = new Error(
        'Customer already has an active Health Card membership. Cannot assign a new card while their current membership is active.'
      );
      err.statusCode = 400;
      throw err;
    }

    // Resolve card number: manually inserted by staff (or unique random if omitted)
    const rawManualNumber = cardNumber || manualCardNumber || cardNumberSuffix;
    const resolvedCardNumber = await resolveCardNumber(plan.planType, rawManualNumber);

    const normalizedMethod = (paymentMethod || 'CASH').toUpperCase().trim();
    const isCash = normalizedMethod === 'CASH';

    // -------------------------------------------------------------
    // OPTION 1: CASH PAYMENT (Face-to-face confirmation, no gateway)
    // -------------------------------------------------------------
    if (isCash) {
      const purchasedAt = new Date();
      const expiresAt = new Date(purchasedAt.getTime() + plan.validityInDays * 24 * 60 * 60 * 1000);
      const cardNumber = resolvedCardNumber;

      customerProfile.hasCard = true;
      customerProfile.activeCard = {
        cardPlan: plan._id,
        planName: plan.name,
        planType: plan.planType,
        cardNumber,
        price: plan.price,
        purchasedAt,
        expiresAt,
        status: 'ACTIVE',
        paymentMethod: 'CASH'
      };

      customerProfile.cardHistory.push({
        cardPlan: plan._id,
        planName: plan.name,
        planType: plan.planType,
        cardNumber,
        price: plan.price,
        purchasedAt,
        expiresAt,
        assignedBy: assignedById,
        paymentMethod: 'CASH',
        paymentStatus: 'COMPLETED'
      });

      await customerProfile.save();

      // Ensure User profile and profileModel are linked
      if (!user.profile || user.profileModel !== PROFILE_MODELS.CUSTOMER) {
        user.profile = customerProfile._id;
        user.profileModel = PROFILE_MODELS.CUSTOMER;
        await user.save();
      }

      // Record a paid Payment document for accounting, receipts, and reporting
      const timestamp = Date.now().toString();
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const orderId = `ORD_CSH_${timestamp.slice(-8)}_${randomSuffix}`;

      const payment = new Payment({
        orderId,
        entityType: 'CARD',
        entityId: plan._id,
        entityModel: 'CardPlan',
        user: user._id,
        customer: customerProfile._id,
        assignedBy: assignedById,
        amount: Number(plan.price),
        currency: 'INR',
        status: 'PAID',
        paymentMethod: 'CASH',
        paymentGroup: 'CASH',
        paymentTime: purchasedAt,
        isFulfilled: true,
        fulfilledAt: purchasedAt,
        customerDetails: {
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          email: user.email,
          phone: user.phoneNumber
        },
        cardDetails: {
          planName: plan.name,
          planType: plan.planType,
          validityInDays: plan.validityInDays,
          discountPercentage: plan.discountPercentage,
          cardNumber
        }
      });
      await payment.save();

      // Send receipt email with PDF attachment asynchronously
      receiptService.sendReceiptEmailForCard(targetCustomerUserId).catch((emailErr) => {
        console.error(`[CardService] Background receipt email failed for customer ${targetCustomerUserId}:`, emailErr.message);
      });

      return {
        requiresPayment: false,
        paymentMethod: 'CASH',
        message: 'Membership card assigned and activated successfully with Cash payment (no payment gateway required).',
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber
        },
        activeCard: customerProfile.activeCard,
        planBenefits: plan.benefits,
        discountPercentage: plan.discountPercentage,
        payment: {
          orderId: payment.orderId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: 'CASH',
          paidAt: payment.fulfilledAt
        }
      };
    }

    // -------------------------------------------------------------
    // OPTION 2: ONLINE / UPI / CARD (Cashfree Payment Gateway)
    // -------------------------------------------------------------
    const orderData = await paymentService.createPaymentOrder({
      userId: targetCustomerUserId,
      targetUserId: targetCustomerUserId,
      assignedById,
      entityType: 'CARD',
      entityId: plan._id,
      cardNumber: resolvedCardNumber,
      returnUrl,
      customNotes: notes || `Face-to-face card assignment (${normalizedMethod}) initiated by staff`
    });

    return {
      requiresPayment: true,
      paymentMethod: normalizedMethod,
      cardNumber: resolvedCardNumber,
      message: 'Cashfree payment session created. Complete payment via payment gateway to activate membership card.',
      paymentOrder: {
        orderId: orderData.orderId,
        paymentSessionId: orderData.paymentSessionId,
        cfOrderId: orderData.cfOrderId,
        amount: orderData.amount,
        currency: orderData.currency,
        customerDetails: orderData.customerDetails,
        cardNumber: resolvedCardNumber,
        cardPlan: {
          _id: plan._id,
          name: plan.name,
          planType: plan.planType,
          price: plan.price,
          validityInDays: plan.validityInDays,
          discountPercentage: plan.discountPercentage,
          benefits: plan.benefits
        }
      }
    };
  }

  /**
   * Get card details for a customer user
   */
  async getCustomerCard(userId, requestingUser = null) {
    if (requestingUser) {
      await customerService.verifyCustomerAccess(userId, requestingUser, 'view card details of');
    }

    const customer = await Customer.findOne({ user: userId }).populate('activeCard.cardPlan');
    if (!customer) {
      const err = new Error('Customer profile not found');
      err.statusCode = 404;
      throw err;
    }

    // Check if card has expired
    if (customer.activeCard && customer.activeCard.expiresAt) {
      if (new Date() > new Date(customer.activeCard.expiresAt)) {
        customer.activeCard.status = 'EXPIRED';
        customer.hasCard = false;
        await customer.save();
      }
    }

    return {
      hasCard: customer.hasCard,
      activeCard: customer.activeCard,
      cardHistory: customer.cardHistory
    };
  }

  /**
   * Helper to format a distributed card object with renewal calculations
   */
  _formatDistributedCard(customerDoc, cardData, isHistorical = false) {
    const now = new Date();
    const purchasedAt = cardData.purchasedAt ? new Date(cardData.purchasedAt) : null;
    const expiresAt = cardData.expiresAt ? new Date(cardData.expiresAt) : null;

    let daysUntilRenewal = null;
    let renewalStatus = 'UNKNOWN';
    let isExpired = false;

    if (expiresAt) {
      const diffMs = expiresAt.getTime() - now.getTime();
      daysUntilRenewal = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isExpired = daysUntilRenewal < 0;

      if (daysUntilRenewal < 0) {
        renewalStatus = 'OVERDUE';
      } else if (daysUntilRenewal === 0) {
        renewalStatus = 'DUE_TODAY';
      } else if (daysUntilRenewal <= 7) {
        renewalStatus = 'EXPIRING_URGENT';
      } else if (daysUntilRenewal <= 30) {
        renewalStatus = 'EXPIRING_SOON';
      } else {
        renewalStatus = 'ACTIVE';
      }
    }

    const effectiveStatus = isExpired ? 'EXPIRED' : (cardData.status || 'ACTIVE');

    return {
      customer: {
        profileId: customerDoc._id,
        customerCode: customerDoc.customerCode,
        membershipType: customerDoc.membershipType,
        address: customerDoc.address,
        user: customerDoc.user ? {
          _id: customerDoc.user._id,
          firstName: customerDoc.user.firstName,
          lastName: customerDoc.user.lastName,
          fullName: `${customerDoc.user.firstName || ''} ${customerDoc.user.lastName || ''}`.trim(),
          email: customerDoc.user.email,
          phoneNumber: customerDoc.user.phoneNumber,
          isActive: customerDoc.user.isActive
        } : null
      },
      cardNumber: cardData.cardNumber,
      planName: cardData.planName,
      planType: cardData.planType,
      cardPlan: cardData.cardPlan,
      price: cardData.price,
      distributedAt: purchasedAt,
      renewalDate: expiresAt,
      daysUntilRenewal,
      renewalStatus,
      isExpired,
      status: effectiveStatus,
      assignedBy: cardData.assignedBy || null,
      paymentStatus: cardData.paymentStatus || 'COMPLETED',
      isHistorical
    };
  }

  /**
   * Helper to retrieve quick summary counts for distributed cards
   */
  async getCardDistributionSummaryCounts() {
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 86400000);
    const next30Days = new Date(now.getTime() + 30 * 86400000);

    const [totalDistributed, activeCards, expiredCards, expiringWithin7Days, expiringWithin30Days] = await Promise.all([
      Customer.countDocuments({ 'activeCard.cardNumber': { $ne: null } }),
      Customer.countDocuments({
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $gte: now },
        'activeCard.status': { $in: ['ACTIVE', 'SUCCESS'] }
      }),
      Customer.countDocuments({
        'activeCard.cardNumber': { $ne: null },
        $or: [
          { 'activeCard.expiresAt': { $lt: now } },
          { 'activeCard.status': 'EXPIRED' }
        ]
      }),
      Customer.countDocuments({
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $gte: now, $lte: next7Days }
      }),
      Customer.countDocuments({
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $gte: now, $lte: next30Days }
      })
    ]);

    return {
      totalDistributed,
      activeCards,
      expiredCards,
      expiringWithin7Days,
      expiringWithin30Days
    };
  }

  /**
   * Super Admin & Manager: List all distributed cards with customer info, distribution date, and renewal date
   */
  async getDistributedCards(
    {
      page = 1,
      limit = 20,
      search,
      status,
      planType,
      planId,
      distributedFrom,
      distributedTo,
      startDate,
      endDate,
      renewalFrom,
      renewalTo,
      expiringWithinDays,
      scope = 'active',
      sortBy = 'purchasedAt',
      sortOrder = 'desc'
    } = {},
    requestingUser = null
  ) {
    const now = new Date();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Apply role scoping if manager
    let scopeBaseFilter = {};
    if (requestingUser && requestingUser.role === ROLES.MANAGER) {
      scopeBaseFilter = await customerService.buildCustomerScopeFilter(requestingUser);
    }

    // Handle scope === 'all': include all cards from cardHistory
    if (scope === 'all') {
      const customerFilter = {
        $and: [
          scopeBaseFilter,
          {
            $or: [
              { 'cardHistory.0': { $exists: true } },
              { 'activeCard.cardNumber': { $ne: null } }
            ]
          }
        ]
      };

      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        const matchedUsers = await User.find({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { phoneNumber: searchRegex }
          ]
        }).select('_id');
        const userIds = matchedUsers.map(u => u._id);

        customerFilter.$and = [
          {
            $or: [
              { user: { $in: userIds } },
              { customerCode: searchRegex },
              { 'activeCard.cardNumber': searchRegex },
              { 'activeCard.planName': searchRegex },
              { 'cardHistory.cardNumber': searchRegex },
              { 'cardHistory.planName': searchRegex }
            ]
          }
        ];
      }

      const customers = await Customer.find(customerFilter)
        .populate('user', 'firstName lastName email phoneNumber isActive createdAt')
        .populate('cardHistory.cardPlan')
        .populate('cardHistory.assignedBy', 'firstName lastName email role')
        .populate('activeCard.cardPlan');

      let allCards = [];

      for (const cust of customers) {
        if (cust.cardHistory && cust.cardHistory.length > 0) {
          cust.cardHistory.forEach((hCard, idx) => {
            const isLatest = idx === cust.cardHistory.length - 1;
            allCards.push(this._formatDistributedCard(cust, hCard, !isLatest));
          });
        } else if (cust.activeCard && cust.activeCard.cardNumber) {
          allCards.push(this._formatDistributedCard(cust, cust.activeCard, false));
        }
      }

      // Filter in memory for scope === 'all'
      if (status) {
        const upperStatus = status.toUpperCase();
        if (upperStatus === 'ACTIVE') {
          allCards = allCards.filter(c => !c.isExpired && ['ACTIVE', 'SUCCESS'].includes(c.status));
        } else if (upperStatus === 'EXPIRED') {
          allCards = allCards.filter(c => c.isExpired || c.status === 'EXPIRED');
        } else if (upperStatus === 'EXPIRING_SOON') {
          allCards = allCards.filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal >= 0 && c.daysUntilRenewal <= 30);
        }
      }

      if (planType) {
        allCards = allCards.filter(c => c.planType && c.planType.toUpperCase() === planType.toUpperCase());
      }

      if (planId) {
        allCards = allCards.filter(c => {
          const cardPlanId = c.cardPlan?._id ? c.cardPlan._id.toString() : c.cardPlan?.toString();
          return cardPlanId === planId.toString();
        });
      }

      const distFrom = distributedFrom || startDate;
      const distTo = distributedTo || endDate;
      if (distFrom) allCards = allCards.filter(c => c.distributedAt && new Date(c.distributedAt) >= new Date(distFrom));
      if (distTo) allCards = allCards.filter(c => c.distributedAt && new Date(c.distributedAt) <= new Date(distTo));

      if (renewalFrom) allCards = allCards.filter(c => c.renewalDate && new Date(c.renewalDate) >= new Date(renewalFrom));
      if (renewalTo) allCards = allCards.filter(c => c.renewalDate && new Date(c.renewalDate) <= new Date(renewalTo));

      if (expiringWithinDays) {
        const d = parseInt(expiringWithinDays, 10);
        if (!isNaN(d)) {
          allCards = allCards.filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal >= 0 && c.daysUntilRenewal <= d);
        }
      }

      // Sort
      const dir = sortOrder === 'asc' ? 1 : -1;
      allCards.sort((a, b) => {
        let valA = a.distributedAt ? new Date(a.distributedAt).getTime() : 0;
        let valB = b.distributedAt ? new Date(b.distributedAt).getTime() : 0;

        if (sortBy === 'expiresAt' || sortBy === 'renewalDate') {
          valA = a.renewalDate ? new Date(a.renewalDate).getTime() : 0;
          valB = b.renewalDate ? new Date(b.renewalDate).getTime() : 0;
        } else if (sortBy === 'price') {
          valA = a.price || 0;
          valB = b.price || 0;
        } else if (sortBy === 'cardNumber') {
          valA = a.cardNumber || '';
          valB = b.cardNumber || '';
          return dir * valA.localeCompare(valB);
        }
        return dir * (valA - valB);
      });

      const total = allCards.length;
      const paginatedCards = allCards.slice(skip, skip + limitNum);
      const summaryMetrics = await this.getCardDistributionSummaryCounts();

      return {
        cards: paginatedCards,
        summary: summaryMetrics,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
          hasMore: skip + limitNum < total
        }
      };
    }

    // Default: scope === 'active' (cards recorded on activeCard)
    const filter = {
      'activeCard.cardNumber': { $ne: null },
      ...scopeBaseFilter
    };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchedUsers = await User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex }
        ]
      }).select('_id');
      const userIds = matchedUsers.map(u => u._id);

      filter.$or = [
        { user: { $in: userIds } },
        { customerCode: searchRegex },
        { 'activeCard.cardNumber': searchRegex },
        { 'activeCard.planName': searchRegex }
      ];
    }

    if (status) {
      const upperStatus = status.toUpperCase();
      if (upperStatus === 'ACTIVE') {
        filter['activeCard.status'] = { $in: ['ACTIVE', 'SUCCESS'] };
        filter['activeCard.expiresAt'] = { $gte: now };
      } else if (upperStatus === 'EXPIRED') {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { 'activeCard.status': 'EXPIRED' },
            { 'activeCard.expiresAt': { $lt: now } }
          ]
        });
      } else if (upperStatus === 'EXPIRING_SOON') {
        const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000);
        filter['activeCard.expiresAt'] = { $gte: now, $lte: thirtyDaysLater };
      }
    }

    if (planType) {
      filter['activeCard.planType'] = planType.toUpperCase();
    }

    if (planId) {
      filter['activeCard.cardPlan'] = planId;
    }

    const distFrom = distributedFrom || startDate;
    const distTo = distributedTo || endDate;
    if (distFrom || distTo) {
      filter['activeCard.purchasedAt'] = {};
      if (distFrom) filter['activeCard.purchasedAt'].$gte = new Date(distFrom);
      if (distTo) filter['activeCard.purchasedAt'].$lte = new Date(distTo);
    }

    if (renewalFrom || renewalTo) {
      filter['activeCard.expiresAt'] = {};
      if (renewalFrom) filter['activeCard.expiresAt'].$gte = new Date(renewalFrom);
      if (renewalTo) filter['activeCard.expiresAt'].$lte = new Date(renewalTo);
    }

    if (expiringWithinDays) {
      const d = parseInt(expiringWithinDays, 10);
      if (!isNaN(d)) {
        filter['activeCard.expiresAt'] = {
          $gte: now,
          $lte: new Date(now.getTime() + d * 86400000)
        };
      }
    }

    // Sort setup
    const sortFieldMap = {
      purchasedAt: 'activeCard.purchasedAt',
      distributedAt: 'activeCard.purchasedAt',
      expiresAt: 'activeCard.expiresAt',
      renewalDate: 'activeCard.expiresAt',
      cardNumber: 'activeCard.cardNumber',
      price: 'activeCard.price',
      createdAt: 'createdAt'
    };
    const sortPath = sortFieldMap[sortBy] || 'activeCard.purchasedAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const [customers, total, summaryMetrics] = await Promise.all([
      Customer.find(filter)
        .populate('user', 'firstName lastName email phoneNumber isActive createdAt')
        .populate('activeCard.cardPlan')
        .sort({ [sortPath]: sortDir })
        .skip(skip)
        .limit(limitNum),
      Customer.countDocuments(filter),
      this.getCardDistributionSummaryCounts()
    ]);

    const formattedCards = customers.map(cust => {
      // Find assignedBy and paymentStatus from cardHistory if available
      let assignedBy = null;
      let paymentStatus = 'COMPLETED';
      if (cust.cardHistory && cust.cardHistory.length > 0) {
        const matchingHistory = cust.cardHistory.find(
          h => h.cardNumber === cust.activeCard.cardNumber
        ) || cust.cardHistory[cust.cardHistory.length - 1];
        if (matchingHistory) {
          assignedBy = matchingHistory.assignedBy;
          paymentStatus = matchingHistory.paymentStatus || 'COMPLETED';
        }
      }

      return this._formatDistributedCard(cust, {
        ...cust.activeCard.toObject ? cust.activeCard.toObject() : cust.activeCard,
        assignedBy,
        paymentStatus
      }, false);
    });

    return {
      cards: formattedCards,
      summary: summaryMetrics,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        hasMore: skip + limitNum < total
      }
    };
  }

  /**
   * Super Admin & Manager: Comprehensive card distribution and renewal statistics
   */
  async getCardDistributionStats(requestingUser = null) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const last7Days = new Date(now.getTime() - 7 * 86400000);

    const next7Days = new Date(now.getTime() + 7 * 86400000);
    const next15Days = new Date(now.getTime() + 15 * 86400000);
    const next30Days = new Date(now.getTime() + 30 * 86400000);
    const next60Days = new Date(now.getTime() + 60 * 86400000);

    let scopeBaseFilter = {};
    if (requestingUser && requestingUser.role === ROLES.MANAGER) {
      scopeBaseFilter = await customerService.buildCustomerScopeFilter(requestingUser);
    }

    const [
      totalDistributedCards,
      activeCards,
      expiredCards,
      uniqueCardHolders,
      totalCustomers,
      overdue,
      expiringToday,
      expiringNext7Days,
      expiringNext15Days,
      expiringNext30Days,
      expiringNext60Days,
      todayDistributions,
      thisWeekDistributions,
      thisMonthDistributions,
      thisYearDistributions,
      byPlanTypeRaw,
      byPlanRaw,
      recentCustomerDocs,
      upcomingRenewalDocs
    ] = await Promise.all([
      Customer.countDocuments({ ...scopeBaseFilter, 'activeCard.cardNumber': { $ne: null } }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $gte: now },
        'activeCard.status': { $in: ['ACTIVE', 'SUCCESS'] }
      }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        $or: [
          { 'activeCard.expiresAt': { $lt: now } },
          { 'activeCard.status': 'EXPIRED' }
        ]
      }),
      Customer.countDocuments({ ...scopeBaseFilter, hasCard: true }),
      Customer.countDocuments(scopeBaseFilter),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $lt: now }
      }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $gte: startOfToday, $lte: endOfToday }
      }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $gte: now, $lte: next7Days }
      }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $gte: now, $lte: next15Days }
      }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $gte: now, $lte: next30Days }
      }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $gte: now, $lte: next60Days }
      }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.purchasedAt': { $gte: startOfToday, $lte: endOfToday }
      }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.purchasedAt': { $gte: last7Days }
      }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.purchasedAt': { $gte: startOfMonth }
      }),
      Customer.countDocuments({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.purchasedAt': { $gte: startOfYear }
      }),
      Customer.aggregate([
        { $match: { ...scopeBaseFilter, 'activeCard.cardNumber': { $ne: null } } },
        {
          $group: {
            _id: '$activeCard.planType',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$activeCard.price' }
          }
        },
        { $sort: { count: -1 } }
      ]),
      Customer.aggregate([
        { $match: { ...scopeBaseFilter, 'activeCard.cardNumber': { $ne: null } } },
        {
          $group: {
            _id: '$activeCard.planName',
            planType: { $first: '$activeCard.planType' },
            cardPlan: { $first: '$activeCard.cardPlan' },
            count: { $sum: 1 },
            totalRevenue: { $sum: '$activeCard.price' }
          }
        },
        { $sort: { count: -1 } }
      ]),
      Customer.find({ ...scopeBaseFilter, 'activeCard.cardNumber': { $ne: null } })
        .populate('user', 'firstName lastName email phoneNumber')
        .populate('activeCard.cardPlan', 'name planType price')
        .sort({ 'activeCard.purchasedAt': -1 })
        .limit(5),
      Customer.find({
        ...scopeBaseFilter,
        'activeCard.cardNumber': { $ne: null },
        'activeCard.expiresAt': { $gte: now }
      })
        .populate('user', 'firstName lastName email phoneNumber')
        .populate('activeCard.cardPlan', 'name planType price')
        .sort({ 'activeCard.expiresAt': 1 })
        .limit(5)
    ]);

    // Format plan type stats with percentages
    const byPlanType = byPlanTypeRaw.map(pt => ({
      planType: pt._id || 'UNKNOWN',
      count: pt.count,
      totalRevenue: pt.totalRevenue,
      percentage: totalDistributedCards > 0 ? Number(((pt.count / totalDistributedCards) * 100).toFixed(1)) : 0
    }));

    const byPlan = byPlanRaw.map(p => ({
      planName: p._id || 'Unknown Plan',
      planType: p.planType,
      cardPlanId: p.cardPlan,
      count: p.count,
      totalRevenue: p.totalRevenue
    }));

    const recentDistributions = recentCustomerDocs.map(c => this._formatDistributedCard(c, c.activeCard));
    const upcomingRenewals = upcomingRenewalDocs.map(c => this._formatDistributedCard(c, c.activeCard));

    const cardPenetrationRate = totalCustomers > 0
      ? Number(((uniqueCardHolders / totalCustomers) * 100).toFixed(1))
      : 0;

    return {
      overview: {
        totalDistributedCards,
        activeCards,
        expiredCards,
        uniqueCardHolders,
        totalCustomers,
        cardPenetrationRate
      },
      renewals: {
        overdue,
        expiringToday,
        expiringNext7Days,
        expiringNext15Days,
        expiringNext30Days,
        expiringNext60Days
      },
      byPlanType,
      byPlan,
      distributionTimeline: {
        today: todayDistributions,
        thisWeek: thisWeekDistributions,
        thisMonth: thisMonthDistributions,
        thisYear: thisYearDistributions
      },
      recentDistributions,
      upcomingRenewals
    };
  }

  /**
   * Super Admin & Manager: Targeted list of cards approaching or past renewal date
   */
  async getUpcomingRenewals(
    {
      days = 30,
      status = 'UPCOMING',
      search,
      page = 1,
      limit = 20,
      sortBy = 'expiresAt',
      sortOrder = 'asc'
    } = {},
    requestingUser = null
  ) {
    const now = new Date();
    const daysNum = Math.max(1, parseInt(days, 10) || 30);
    const targetDate = new Date(now.getTime() + daysNum * 86400000);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let scopeBaseFilter = {};
    if (requestingUser && requestingUser.role === ROLES.MANAGER) {
      scopeBaseFilter = await customerService.buildCustomerScopeFilter(requestingUser);
    }

    const filter = {
      'activeCard.cardNumber': { $ne: null },
      ...scopeBaseFilter
    };

    const upperStatus = (status || 'UPCOMING').toUpperCase();
    if (upperStatus === 'UPCOMING') {
      filter['activeCard.expiresAt'] = { $gte: now, $lte: targetDate };
    } else if (upperStatus === 'OVERDUE') {
      filter['activeCard.expiresAt'] = { $lt: now };
    } else if (upperStatus === 'ALL') {
      filter['activeCard.expiresAt'] = { $lte: targetDate };
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchedUsers = await User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex }
        ]
      }).select('_id');
      const userIds = matchedUsers.map(u => u._id);

      filter.$or = [
        { user: { $in: userIds } },
        { customerCode: searchRegex },
        { 'activeCard.cardNumber': searchRegex },
        { 'activeCard.planName': searchRegex }
      ];
    }

    const sortPath = sortBy === 'purchasedAt' ? 'activeCard.purchasedAt' : 'activeCard.expiresAt';
    const sortDir = sortOrder === 'desc' ? -1 : 1;

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .populate('user', 'firstName lastName email phoneNumber isActive')
        .populate('activeCard.cardPlan')
        .sort({ [sortPath]: sortDir })
        .skip(skip)
        .limit(limitNum),
      Customer.countDocuments(filter)
    ]);

    const formattedCards = customers.map(c => this._formatDistributedCard(c, c.activeCard));

    return {
      windowDays: daysNum,
      status: upperStatus,
      renewals: formattedCards,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        hasMore: skip + limitNum < total
      }
    };
  }
}

export default new CardService();
