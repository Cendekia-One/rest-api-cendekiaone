const {
  post,
  user,
  likes,
  comments,
  sequelize,
  saved,
  following,
} = require("../models");

const {
  responseMessage,
  responseData,
  responseWithPagination,
} = require("../utils/responseHandle");
const { Storage } = require("@google-cloud/storage");
const path = require("path");

const storage = new Storage({
  keyFilename: path.join(
    __dirname,
    "../config/usman-project-404306-f6a7db49c320.json"
  ),
  projectId: "usman-project-404306",
});

const bucket = storage.bucket("cendikiaone");

async function posted(req, res) {
  try {
    const { post_title, post_body, id_user, categories, sub_categories } =
      req.body;

    if (!id_user) {
      return responseMessage(res, 400, "Cannot create post before login", true);
    }

    if (!req.file) {
      return responseMessage(res, 400, "image required", true);
    }
    const image = req.file;
    const imageName = `${Date.now()}_${image.originalname}`;

    const fileStream = bucket.file(imageName).createWriteStream({
      metadata: {
        contentType: image.mimetype,
      },
    });

    fileStream.on("error", (err) => {
      console.error(err);
      responseMessage(res, 500, "Failed to upload  image", true);
    });

    fileStream.on("finish", async () => {
      const image_url = `https://storage.googleapis.com/${bucket.name}/${imageName}`;

      const postReturn = await post.create({
        post_title,
        post_body,
        id_user,
        image_url,
        categories,
        sub_categories,
      });

      const createdPost = await post.findByPk(postReturn.id, {
        include: [
          {
            model: user,
            attributes: ["username"],
            as: "createdByUser",
          },
        ],
      });

      const formattedResponse = {
        status: "Post Created",
        data: {
          idPost: createdPost.id,
          createBy: createdPost.createdByUser.username,
          profileCreator: createdPost.createdByUser.profile_picture,
          postPicture: createdPost.image_url,
          postTitle: createdPost.post_title,
          postBody: createdPost.post_body,
          category: createdPost.categories,
          subCatergory: createdPost.sub_categories,
          likes: 0,
          comments: 0,
          createdAt: createdPost.createdAt,
        },
      };

      responseMessage(res, 201, formattedResponse, false);
    });

    fileStream.end(image.buffer);
  } catch (error) {
    console.error(error);
    responseMessage(res, 500, `${error}`);
  }
}

async function editPost(req, res) {
  try {
    const {
      id_post,
      post_title,
      post_body,
      id_user,
      categories,
      sub_categories,
    } = req.body;

    if (!id_user) {
      return responseMessage(res, 201, "Cannot create post before login", true);
    }

    await post.update(
      {
        post_title: post_title,
        post_body: post_body,
        id_user: id_user,
        categories: categories,
        sub_categories: sub_categories,
      },
      { where: { id: id_post } }
    );

    const createdPost = await post.findByPk(id_post, {
      include: [
        {
          model: user,
          attributes: ["username"],
          as: "createdByUser",
        },
      ],
    });
    const formattedResponse = {
      status: "Post Updated",
      data: {
        idPost: id_post,
        createBy: createdPost.createdByUser.username,
        profileCreator: createdPost.createdByUser.profile_picture,
        postTitle: createdPost.post_title,
        postBody: createdPost.post_body,
        category: createdPost.categories,
        subCatergory: createdPost.sub_categories,
        likes: 0,
        comments: 0,
        createdAt: createdPost.createdAt,
      },
    };

    responseMessage(res, 201, formattedResponse, false);
  } catch (error) {
    console.error(error);
    responseMessage(res, 500, `Internal server error ${error}`);
  }
}

async function getAllPost(req, res) {
  const page = req.query.page || 1;
  const pageSize = 10;
  try {
    const { count, rows: postingans } = await post.findAndCountAll({
      include: [
        {
          model: user,
          attributes: ["name", "username", "profile_picture"],
          as: "createdByUser",
        },
      ],
      attributes: {
        exclude: ["id_user"],
      },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    const totalPages = Math.ceil(count / pageSize);

    const postIds = postingans.map((postingan) => postingan.id);

    const likesCount = await likes.findAll({
      attributes: [
        "id_post",
        [
          sequelize.fn("COUNT", sequelize.literal("DISTINCT liked_by_user")),
          "likeCount",
        ],
      ],
      where: {
        id_post: postIds,
      },
      group: ["id_post"],
    });

    const commentCount = await comments.count({
      where: {
        id_post: postIds,
      },
    });
    const likesMap = {};

    likesCount.forEach((like) => {
      likesMap[like.id_post] = like.dataValues.likeCount;
    });

    const formattedPostings = postingans.map((postingan) => {
      const idPost = postingan.id;
      
      return {
        idPost,
        createBy: postingan.createdByUser.username,
        createById: postingan.createdByUser.id,
        profileCreator: postingan.createdByUser.profile_picture,
        postPicture: postingan.image_url,
        postTitle: postingan.post_title,
        postBody: postingan.post_body,
        category: postingan.categories,
        subCatergory: postingan.sub_categories,
        likes: likesMap[idPost] || 0,
        comment: commentCount || 0,
        createdAt: postingan.created_at,

      };
    });

    const paginationInfo = {
      currentPage: page,
      totalPages: totalPages,
      totalPosts: count,
    };

    responseWithPagination(
      res,
      200,
      formattedPostings,
      paginationInfo,
      "Success"
    );
  } catch (error) {
    responseMessage(res, 500, `Internal server error ${error}`);
  }
}

async function getPostByidUser(req, res) {
  const page = req.query.page || 1;
  const pageSize = 10;
  const { userId } = req.params;
  try {
    const { count, rows: postingans } = await post.findAndCountAll({
      include: [
        {
          model: user,
          attributes: ["id", "username", "profile_picture"],
          as: "createdByUser",
        },
      ],
      attributes: {
        exclude: ["id_user"],
      },
      where: {
        id_user: userId,
      },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    const totalPages = Math.ceil(count / pageSize);

    const postIds = postingans.map((postingan) => postingan.id);
    const savedData = await saved.findAll({
      where: {
        id_posts: postIds,
        saved_by_user: userId,
      },
    });
    
    const likesData = await likes.findAll({
      where: {
        id_post: postIds,
        liked_by_user: userId,
      },
    });
    const likesCount = await likes.findAll({
      attributes: [
        "id_post",
        [
          sequelize.fn("COUNT", sequelize.literal("DISTINCT liked_by_user")),
          "likeCount",
        ],
      ],
      where: {
        id_post: postIds,
      },
      group: ["id_post"],
    });

    const commentCount = await comments.count({
      where: {
        id_post: postIds,
      },
    });

    const likesMap = {};

    likesCount.forEach((like) => {
      likesMap[like.id_post] = like.dataValues.likeCount;
    });

    const formattedPostings = postingans.map((postingan) => {
      const idPost = postingan.id;
      const isSaved = savedData.some((item) => item.id_posts === idPost);
      const isLike = likesData.some((item) => item.id_post === idPost);
      return {
        idPost,
        createBy: postingan.createdByUser.username,
        createById: postingan.createdByUser.id,
        profileCreator: postingan.createdByUser.profile_picture,
        postPicture: postingan.image_url,
        postTitle: postingan.post_title,
        postBody: postingan.post_body,
        category: postingan.categories,
        subCatergory: postingan.sub_categories,
        likes: likesMap[idPost] || 0,
        comment: commentCount || 0,
        createdAt: postingan.created_at,
        isLike: isLike,
        isSaved: isSaved,
      };
    });

    const paginationInfo = {
      currentPage: page,
      totalPages: totalPages,
      totalPosts: count,
    };

    responseWithPagination(
      res,
      200,
      formattedPostings,
      paginationInfo,
      "Success"
    );
  } catch (error) {
    responseMessage(res, 500, `Internal server error ${error}`);
  }
}

const { Op } = require("sequelize");
async function getFollowedPosts(req, res) {
  const page = req.query.page || 1;
  const pageSize = 10;
  const { userId } = req.params;
  try {
    const followedUsers = await following.findAll({
      where: {
        account_owner: userId,
      },
    });
    const followedUserIds = followedUsers.map((user) => user.following_user);

    const { count, rows: postingans } = await post.findAndCountAll({
      include: [
        {
          model: user,
          attributes: ["id","name", "username", "profile_picture"],
          as: "createdByUser",
        },
      ],
      attributes: {
        exclude: ["id_user"],
      },
      where: {
        [Op.or]: [{ id_user: followedUserIds }, { id_user: userId }],
      },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const totalPages = Math.ceil(count / pageSize);

    const postIds = postingans.map((postingan) => postingan.id);
    const likesCount = await likes.findAll({
      attributes: [
        "id_post",
        [
          sequelize.fn("COUNT", sequelize.literal("DISTINCT liked_by_user")),
          "likeCount",
        ],
      ],
      where: {
        id_post: postIds,
      },
      group: ["id_post"],
    });

    const commentCount = await comments.count({
      where: {
        id_post: postIds,
      },
    });
    const savedData = await saved.findAll({
      where: {
        id_posts: postIds,
        saved_by_user: userId,
      },
    });
    
    const likesData = await likes.findAll({
      where: {
        id_post: postIds,
        liked_by_user: userId,
      },
    });

    const likesMap = {};

    likesCount.forEach((like) => {
      likesMap[like.id_post] = like.dataValues.likeCount;
    });

    const formattedPostings = postingans.map((postingan) => {
      const idPost = postingan.id;
      const isSaved = savedData.some((item) => item.id_posts === idPost);
      const isLike = likesData.some((item) => item.id_post === idPost);
      return {
        idPost,
        createBy: postingan.createdByUser.username,
        createById: postingan.createdByUser.id,
        profileCreator: postingan.createdByUser.profile_picture,
        postPicture: postingan.image_url,
        postTitle: postingan.post_title,
        postBody: postingan.post_body,
        category: postingan.categories,
        subCatergory: postingan.sub_categories,
        likes: likesMap[idPost] || 0,
        comment: commentCount || 0,
        createdAt: postingan.created_at,
        isLike: isLike,
        isSaved: isSaved,
      };
    });

    const paginationInfo = {
      currentPage: page,
      totalPages: totalPages,
      totalPosts: count,
    };

    responseWithPagination(
      res,
      200,
      formattedPostings,
      paginationInfo,
      "Success"
    );
  } catch (error) {
    responseMessage(res, 500, `Internal server error ${error}`);
  }
}

async function getPostById(req, res) {
  try {
    const { detail } = req.params;
    if (!detail) {
      return responseMessage(res, 404, "required id post", true);
    }

    const postingans = await post.findOne({
      include: [
        {
          model: user,
          attributes: ["id", "username", "profile_picture"],
          as: "createdByUser",
        },
      ],
      attributes: {
        exclude: ["id_user"],
      },
      where: { id: detail },
    });

    if (!postingans) {
      return responseMessage(res, 404, "id_post not found", true);
    }

    const likeCount = await likes.count({
      where: {
        id_post: detail,
      },
    });

    const commentCount = await comments.count({
      where: {
        id_post: detail,
      },
    });


    const isSaved = await saved.findOne({
      where: {
        id_posts: detail,
        saved_by_user: req.params.userId, 
      },
    });

    const isLike = await likes.findOne({
      where: {
        id_post: detail,
        liked_by_user: req.params.userId, 
      },
    });

    const formattedPostings = {
      idPost: postingans.id,
      createBy: postingans.createdByUser.username,
      createById: postingans.createdByUser.id,
      profileCreator: postingans.createdByUser.profile_picture,
      postPicture: postingans.image_url,
      postTitle: postingans.post_title,
      postBody: postingans.post_body,
      category: postingans.categories,
      subCatergory: postingans.sub_categories,
      likes: likeCount || 0,
      comments: commentCount || 0,
      createdAt: postingans.created_at,
      isSaved: Boolean(isSaved) || false, 
      isLike: Boolean(isLike) || false,
    };

    responseData(res, 200, formattedPostings, 0, "Success");
  } catch (error) {
    responseMessage(res, 500, `Internal server error${error}`);
  }
}


async function likePost(req, res) {
  const { post_id, liked_by } = req.body;

  try {
    const isAlreadyLike = await likes.findOne({
      where: [{ id_post: post_id }, { liked_by_user: liked_by }],
    });

    if (isAlreadyLike) {
      await likes.destroy({
        where:[{ id_post: post_id},{liked_by_user: liked_by}]
      });
      return responseMessage(res, 400, "already unlike this post");
    }

    await likes.create({
      id_post: post_id,
      liked_by_user: liked_by,
    });

    return responseMessage(res, 200, "successfully liked this post");
  } catch (error) {
    return responseMessage(res, 500, `${error}`);
  }
}

async function getLikedUsers(req, res) {
  const { id } = req.params;
  const page = req.query.page || 1;
  const pageSize = 10;
  try {
    const { count, rows: users } = await likes.findAndCountAll({
      include: [
        {
          model: user,
          attributes: ["username", "profile_picture"],
          as: "likedByUser",
        },
      ],
      where: {
        id: id,
      },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    const totalPages = Math.ceil(count / pageSize);

    const formattedLikes = users.map((likeBy) => {
      return {
        id: likeBy.id,
        username: likeBy.likedByUser.username,
        profilePicture: likeBy.likedByUser.profile_picture,
      };
    });
    const paginationInfo = {
      currentPage: page,
      totalPages: totalPages,
      totalPosts: count,
    };

    responseWithPagination(res, 200, formattedLikes, paginationInfo, "Success");
  } catch (error) {
    responseMessage(res, 200, `${error}`, true);
  }
}

async function commentPost(req, res) {
  const { post_id, comment_by, comment_body } = req.body;
  try {
    if (!post_id) {
      return responseMessage(res, 400, "post cannot be null");
    }

    const commentReturn = await comments.create({
      id_post: post_id,
      comment_by_user: comment_by,
      comment_body: comment_body,
    });

    if (!commentReturn) {
      return responseMessage(res, 500, "post not found");
    }

    const createdComment = await comments.findByPk(commentReturn.id, {
      include: [
        {
          model: user,
          attributes: ["username"],
          as: "commentByUser",
        },
      ],
    });

    return responseData(
      res,
      200,
      {
        username: createdComment.commentByUser.username,
        comments: createdComment.comment_body,
      },
      "success"
    );
  } catch (error) {
    return responseMessage(res, 500, `${error}`);
  }
}

async function getCommentedUser(req, res) {
  const { id } = req.params;
  const page = req.query.page || 1;
  const pageSize = 10;
  try {
    const { count, rows: users } = await comments.findAndCountAll({
      include: [
        {
          model: user,
          attributes: ["username", "profile_picture"],
          as: "commentByUser",
        },
      ],
      where: {
        id_post: id,
      },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    const totalPages = Math.ceil(count / pageSize);

    const formattedComments = users.map((comentBy) => {
      return {
        id: comentBy.id,
        comment_body: comentBy.comment_body,
        username: comentBy.commentByUser.username,
        profilePicture: comentBy.commentByUser.profile_picture,
      };
    });
    const paginationInfo = {
      currentPage: page,
      totalPages: totalPages,
      totalPosts: count,
    };

    responseWithPagination(
      res,
      200,
      formattedComments,
      paginationInfo,
      "Success"
    );
  } catch (error) {
    responseMessage(res, 200, `${error}`, true);
  }
}

async function deletePost(req, res) {
  const { id } = req.params;
  try {
    // Hapus dari tabel likes
    await likes.destroy({
      where: {
        id_post: id,
      },
    });

    // Hapus dari tabel comments
    await comments.destroy({
      where: {
        id_post: id,
      },
    });

    // Hapus dari tabel saved
    await saved.destroy({
      where: {
        id_posts: id,
      },
    });

    // Hapus dari tabel posts
    const deleteReturn = await post.destroy({
      where: {
        id: id,
      },
    });

    if (!deleteReturn) {
      responseMessage(res, 404, "Post not found", false);
    } else {
      responseMessage(res, 200, "Delete post success", false);
    }
  } catch (error) {
    responseMessage(res, 500, `${error}`, true);
  }
}



module.exports = {
  posted,
  getAllPost,
  getPostById,
  likePost,
  commentPost,
  deletePost,
  getLikedUsers,
  getCommentedUser,
  getFollowedPosts,
  editPost,
  getPostByidUser,
};
