import Service from './service.model.js';

class ServiceService {
  /**
   * Create a new diagnostic / lab test service
   */
  async createService(serviceData, creatorId) {
    const service = new Service({
      ...serviceData,
      createdBy: creatorId
    });

    return await service.save();
  }

  /**
   * Update an existing service
   */
  async updateService(serviceId, updateData) {
    const service = await Service.findById(serviceId);
    if (!service) {
      const err = new Error('Diagnostic test service not found');
      err.statusCode = 404;
      throw err;
    }

    Object.assign(service, updateData);
    await service.save();

    return service;
  }

  /**
   * Delete a service
   */
  async deleteService(serviceId) {
    const service = await Service.findById(serviceId);
    if (!service) {
      const err = new Error('Diagnostic test service not found');
      err.statusCode = 404;
      throw err;
    }

    await Service.findByIdAndDelete(serviceId);
    return { success: true, message: 'Diagnostic test service deleted successfully' };
  }

  /**
   * Toggle service active status
   */
  async toggleStatus(serviceId, isActive) {
    const service = await Service.findById(serviceId);
    if (!service) {
      const err = new Error('Diagnostic test service not found');
      err.statusCode = 404;
      throw err;
    }

    service.isActive = isActive !== undefined ? isActive : !service.isActive;
    await service.save();

    return service;
  }

  /**
   * Get single service by ID
   */
  async getServiceById(serviceId) {
    const service = await Service.findById(serviceId).populate(
      'createdBy',
      'firstName lastName email role'
    );
    if (!service) {
      const err = new Error('Diagnostic test service not found');
      err.statusCode = 404;
      throw err;
    }
    return service;
  }

  /**
   * Query all services with filtering, search, and pagination
   */
  async getAllServices({
    testType,
    search,
    requiresFasting,
    isActive,
    sampleType,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = {}) {
    const filter = {};

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (testType) {
      filter.testType = { $regex: new RegExp(`^${testType}$`, 'i') };
    }

    if (sampleType) {
      filter.sampleType = { $regex: new RegExp(sampleType, 'i') };
    }

    if (requiresFasting !== undefined && requiresFasting !== '') {
      filter.requiresFasting = requiresFasting === 'true' || requiresFasting === true;
    }

    if (search) {
      filter.$or = [
        { testName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { testType: { $regex: search, $options: 'i' } },
        { sampleType: { $regex: search, $options: 'i' } },
        { parametersMeasured: { $elemMatch: { $regex: search, $options: 'i' } } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [services, total] = await Promise.all([
      Service.find(filter)
        .populate('createdBy', 'firstName lastName email role')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Service.countDocuments(filter)
    ]);

    return {
      services,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * Get distinct categories / test types for filters
   */
  async getCategories() {
    const categories = await Service.distinct('testType', { isActive: true });
    const sampleTypes = await Service.distinct('sampleType', { isActive: true });
    return {
      testTypes: categories,
      sampleTypes
    };
  }
}

export default new ServiceService();
