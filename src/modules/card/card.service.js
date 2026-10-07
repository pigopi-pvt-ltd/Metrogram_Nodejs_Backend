import CardPlan from './cardPlan.model.js';
import Customer from '../customer/customer.model.js';
import User from '../user/user.model.js';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';

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
    const cardNumber = `MC-${plan.planType.substring(0, 3)}-${Date.now().toString().slice(-6)}`;

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
   * Staff (Super Admin, Manager, Employee) assigns a card to a customer
   */
  async assignCardToCustomer({ targetCustomerUserId, cardPlanId, assignedById, paymentStatus = 'COMPLETED' }) {
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

    const purchasedAt = new Date();
    const expiresAt = new Date(purchasedAt.getTime() + plan.validityInDays * 24 * 60 * 60 * 1000);
    const cardNumber = `MC-${plan.planType.substring(0, 3)}-${Date.now().toString().slice(-6)}`;

    customerProfile.hasCard = true;
    customerProfile.activeCard = {
      cardPlan: plan._id,
      planName: plan.name,
      planType: plan.planType,
      cardNumber,
      price: plan.price,
      purchasedAt,
      expiresAt,
      status: 'ACTIVE'
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
      paymentStatus
    });

    await customerProfile.save();

    // Ensure User profile and profileModel are linked
    if (!user.profile || user.profileModel !== PROFILE_MODELS.CUSTOMER) {
      user.profile = customerProfile._id;
      user.profileModel = PROFILE_MODELS.CUSTOMER;
      await user.save();
    }

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
   * Get card details for a customer user
   */
  async getCustomerCard(userId) {
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
}

export default new CardService();
