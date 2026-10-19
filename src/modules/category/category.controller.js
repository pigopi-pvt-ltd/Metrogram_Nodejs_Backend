import categoryService from './category.service.js';

class CategoryController {
  /**
   * Create a new category (Super Admin only)
   */
  async create(req, res, next) {
    try {
      const { name, slug, description, isActive } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Category name is required'
        });
      }

      const category = await categoryService.createCategory(
        { name, slug, description, isActive },
        req.user._id
      );

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category
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
   * List all categories (Public / Admin)
   */
  async getAll(req, res, next) {
    try {
      const result = await categoryService.getAllCategories(req.query);

      res.status(200).json({
        success: true,
        count: result.categories.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.categories
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single category by ID or slug (Public)
   */
  async getById(req, res, next) {
    try {
      const category = await categoryService.getCategoryById(req.params.id);
      res.status(200).json({
        success: true,
        data: category
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
   * Update category (Super Admin only)
   */
  async update(req, res, next) {
    try {
      const category = await categoryService.updateCategory(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: category
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
   * Toggle category active status (Super Admin only)
   */
  async toggleStatus(req, res, next) {
    try {
      const { isActive } = req.body;
      const category = await categoryService.toggleStatus(req.params.id, isActive);
      res.status(200).json({
        success: true,
        message: `Category is now ${category.isActive ? 'Active' : 'Inactive'}`,
        data: category
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
   * Delete category (Super Admin only)
   */
  async delete(req, res, next) {
    try {
      const result = await categoryService.deleteCategory(req.params.id);
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
}

export default new CategoryController();
