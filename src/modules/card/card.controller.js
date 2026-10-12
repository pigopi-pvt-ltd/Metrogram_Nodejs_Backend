import cardService from './card.service.js';

class CardController {
  /**
   * Create a Card Plan (Super Admin only)
   */
  async createPlan(req, res, next) {
    try {
      const {
        name,
        planType,
        price,
        validityInDays,
        description,
        benefits,
        discountPercentage,
        badge,
        isActive
      } = req.body;

      if (!name || !price || !description || !benefits) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: name, price, description, and benefits are required'
        });
      }

      const plan = await cardService.createCardPlan(
        {
          name,
          planType: planType ? planType.toUpperCase() : 'YEARLY',
          price: Number(price),
          validityInDays: validityInDays ? Number(validityInDays) : (planType === 'MONTHLY' ? 30 : 365),
          description,
          benefits: Array.isArray(benefits) ? benefits : [benefits],
          discountPercentage: discountPercentage ? Number(discountPercentage) : 0,
          badge: badge || 'Standard',
          isActive: isActive !== undefined ? Boolean(isActive) : true
        },
        req.user._id
      );

      res.status(201).json({
        success: true,
        message: 'Card plan created successfully',
        data: plan
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Update a Card Plan (Super Admin only)
   */
  async updatePlan(req, res, next) {
    try {
      const plan = await cardService.updateCardPlan(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Card plan updated successfully',
        data: plan
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Delete a Card Plan (Super Admin only)
   */
  async deletePlan(req, res, next) {
    try {
      const result = await cardService.deleteCardPlan(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Toggle Card Plan active status (Super Admin only)
   */
  async togglePlanStatus(req, res, next) {
    try {
      const { isActive } = req.body;
      const plan = await cardService.togglePlanStatus(req.params.id, isActive);
      res.status(200).json({
        success: true,
        message: `Card plan is now ${plan.isActive ? 'Active' : 'Inactive'}`,
        data: plan
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get single Card Plan by ID (Public)
   */
  async getPlanById(req, res, next) {
    try {
      const plan = await cardService.getCardPlanById(req.params.id);
      res.status(200).json({
        success: true,
        data: plan
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * List all Card Plans (Public for landing page)
   */
  async getAllPlans(req, res, next) {
    try {
      const result = await cardService.getAllCardPlans(req.query);
      res.status(200).json({
        success: true,
        count: result.plans.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.plans
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Customer purchases a Card
   */
  async purchaseCard(req, res, next) {
    try {
      const { cardPlanId, paymentMethod } = req.body;
      if (!cardPlanId) {
        return res.status(400).json({
          success: false,
          message: 'cardPlanId is required'
        });
      }

      const result = await cardService.purchaseCard({
        customerUserId: req.user._id,
        cardPlanId,
        paymentMethod
      });

      res.status(200).json({
        success: true,
        message: 'Membership card purchased and activated successfully',
        data: result
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Staff assigns a card to customer
   */
  async assignCard(req, res, next) {
    try {
      const {
        customerUserId,
        cardPlanId,
        paymentMethod = 'CASH',
        paymentStatus = 'COMPLETED',
        returnUrl,
        notes
      } = req.body;

      if (!customerUserId || !cardPlanId) {
        return res.status(400).json({
          success: false,
          message: 'customerUserId and cardPlanId are required'
        });
      }

      const result = await cardService.assignCardToCustomer({
        targetCustomerUserId: customerUserId,
        cardPlanId,
        assignedById: req.user._id,
        paymentMethod,
        paymentStatus,
        returnUrl,
        notes
      });

      const statusCode = result.requiresPayment ? 201 : 200;
      res.status(statusCode).json({
        success: true,
        message: result.message,
        requiresPayment: result.requiresPayment,
        paymentMethod: result.paymentMethod,
        data: result
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Current customer gets their card details
   */
  async getMyCard(req, res, next) {
    try {
      const result = await cardService.getCustomerCard(req.user._id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Staff views customer's card details
   */
  async getCustomerCard(req, res, next) {
    try {
      const result = await cardService.getCustomerCard(req.params.userId);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Super Admin & Manager: View distributed cards among customers with dates and renewal information
   */
  async getDistributedCards(req, res, next) {
    try {
      const result = await cardService.getDistributedCards(req.query);
      res.status(200).json({
        success: true,
        message: 'Distributed cards retrieved successfully',
        summary: result.summary,
        count: result.cards.length,
        pagination: result.pagination,
        data: result.cards
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Super Admin & Manager: Comprehensive card distribution and renewal statistics
   */
  async getDistributionStats(req, res, next) {
    try {
      const stats = await cardService.getCardDistributionStats();
      res.status(200).json({
        success: true,
        message: 'Card distribution statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Super Admin & Manager: Targeted renewal tracking and upcoming renewals list
   */
  async getUpcomingRenewals(req, res, next) {
    try {
      const result = await cardService.getUpcomingRenewals(req.query);
      res.status(200).json({
        success: true,
        message: 'Card renewals retrieved successfully',
        windowDays: result.windowDays,
        status: result.status,
        count: result.renewals.length,
        pagination: result.pagination,
        data: result.renewals
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }
}

export default new CardController();
