import mongoose from 'mongoose';
import Category from './category.model.js';
import Service from '../service/service.model.js';

class CategoryService {
  /**
   * Helper to slugify a category name
   */
  slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-');
  }

  /**
   * Create a new category
   */
  async createCategory(categoryData, creatorId) {
    const name = categoryData.name ? categoryData.name.trim() : '';
    if (!name) {
      const err = new Error('Category name is required');
      err.statusCode = 400;
      throw err;
    }

    const slug = categoryData.slug
      ? this.slugify(categoryData.slug)
      : this.slugify(name);

    // Check if name or slug already exists
    const existing = await Category.findOne({
      $or: [{ name: { $regex: new RegExp(`^${name}$`, 'i') } }, { slug }]
    });

    if (existing) {
      const err = new Error(`Category "${name}" or slug "${slug}" already exists`);
      err.statusCode = 400;
      throw err;
    }

    const category = new Category({
      name,
      slug,
      description: categoryData.description ? categoryData.description.trim() : '',
      isActive: categoryData.isActive !== undefined ? Boolean(categoryData.isActive) : true,
      createdBy: creatorId
    });

    return await category.save();
  }

  /**
   * Get all categories with filtering and optional pagination
   */
  async getAllCategories({
    isActive,
    search,
    page,
    limit,
    sortBy = 'name',
    sortOrder = 'asc'
  } = {}) {
    const filter = {};

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortObj = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // If neither page nor limit is provided, return all categories (useful for dropdowns)
    if (!page && !limit) {
      const categories = await Category.find(filter)
        .populate('createdBy', 'firstName lastName email role')
        .sort(sortObj);

      return {
        categories,
        total: categories.length
      };
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .populate('createdBy', 'firstName lastName email role')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Category.countDocuments(filter)
    ]);

    return {
      categories,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * Get single category by ID or slug
   */
  async getCategoryById(idOrSlug) {
    let category = null;

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      category = await Category.findById(idOrSlug).populate(
        'createdBy',
        'firstName lastName email role'
      );
    }

    if (!category) {
      category = await Category.findOne({ slug: String(idOrSlug).toLowerCase().trim() }).populate(
        'createdBy',
        'firstName lastName email role'
      );
    }

    if (!category) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(categoryId, updateData) {
    const category = await Category.findById(categoryId);
    if (!category) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }

    if (updateData.name && updateData.name.trim() !== category.name) {
      const name = updateData.name.trim();
      const existing = await Category.findOne({
        _id: { $ne: categoryId },
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });

      if (existing) {
        const err = new Error(`Category with name "${name}" already exists`);
        err.statusCode = 400;
        throw err;
      }
      category.name = name;

      if (!updateData.slug) {
        category.slug = this.slugify(name);
      }
    }

    if (updateData.slug) {
      const slug = this.slugify(updateData.slug);
      const existing = await Category.findOne({
        _id: { $ne: categoryId },
        slug
      });

      if (existing) {
        const err = new Error(`Category with slug "${slug}" already exists`);
        err.statusCode = 400;
        throw err;
      }
      category.slug = slug;
    }

    if (updateData.description !== undefined) {
      category.description = String(updateData.description).trim();
    }

    if (updateData.isActive !== undefined) {
      category.isActive = Boolean(updateData.isActive);
    }

    await category.save();
    return category;
  }

  /**
   * Toggle category active status
   */
  async toggleStatus(categoryId, isActive) {
    const category = await Category.findById(categoryId);
    if (!category) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }

    category.isActive = isActive !== undefined ? Boolean(isActive) : !category.isActive;
    await category.save();
    return category;
  }

  /**
   * Delete category (prevent deletion if test services are linked)
   */
  async deleteCategory(categoryId) {
    const category = await Category.findById(categoryId);
    if (!category) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }

    // Check if any Service is using this category
    const linkedTestsCount = await Service.countDocuments({ category: categoryId });
    if (linkedTestsCount > 0) {
      const err = new Error(
        `Cannot delete category "${category.name}" because ${linkedTestsCount} test(s) are assigned to it. Please reassign or delete those tests first.`
      );
      err.statusCode = 400;
      throw err;
    }

    await Category.findByIdAndDelete(categoryId);
    return {
      success: true,
      message: `Category "${category.name}" deleted successfully`
    };
  }

  /**
   * Seed default categories (Pathology, Radiology, Physiotherapy)
   */
  async seedDefaultCategories(creatorId = null) {
    const defaultCategories = [
      {
        name: 'Pathology',
        slug: 'pathology',
        description: 'Comprehensive clinical pathology, biochemistry, hematology, and diagnostic lab tests.'
      },
      {
        name: 'Radiology',
        slug: 'radiology',
        description: 'Diagnostic medical imaging services including X-Ray, Ultrasound, CT Scan, and MRI.'
      },
      {
        name: 'Physiotherapy',
        slug: 'physiotherapy',
        description: 'Physical therapy, rehabilitation, mobility restoration, and musculoskeletal pain management.'
      }
    ];

    const seeded = [];
    for (const cat of defaultCategories) {
      let existing = await Category.findOne({
        $or: [{ name: { $regex: new RegExp(`^${cat.name}$`, 'i') } }, { slug: cat.slug }]
      });

      if (!existing) {
        existing = await Category.create({
          ...cat,
          isActive: true,
          createdBy: creatorId
        });
      }
      seeded.push(existing);
    }

    return seeded;
  }
}

export default new CategoryService();
