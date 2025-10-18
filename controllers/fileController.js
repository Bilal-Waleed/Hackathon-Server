import { getSignedUploadParams } from "../config/cloudinary.js";
import cloudinary from "../config/cloudinary.js";

export const getSignedParams = async (req, res) => {
  try {
    const folder = req.query.folder || 'healthmate';
    const signed = getSignedUploadParams(folder);
    return res.status(200).json(signed);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const extractPdfPages = async (req, res) => {
  try {
    const { filePublicId, fileUrl, folder, pages = 1, tag } = req.body;
    if ((!filePublicId && !fileUrl) || !folder) return res.status(400).json({ message: 'Missing fields' });
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const items = [];
    const total = Math.max(1, Number(pages));
    for (let i = 1; i <= total; i++) {
      let src;
      if (fileUrl) {
        src = fileUrl;
      } else {
        // Build a SIGNED transformation URL to avoid strict transformation issues
        src = cloudinary.url(filePublicId, {
          resource_type: 'image',
          type: 'upload',
          sign_url: true,
          transformation: [{ page: i, fetch_format: 'jpg' }],
          secure: true,
        });
      }
      const up = await cloudinary.uploader.upload(src, {
        folder,
        public_id: `page_${i}`,
        overwrite: true,
        tags: tag ? [tag] : undefined,
        resource_type: 'image',
        transformation: [{ page: i, fetch_format: 'jpg' }],
      });
      items.push({ url: up.secure_url, public_id: up.public_id });
    }
    return res.status(200).json({ items, folder, tag });
  } catch (err) {
    return res.status(500).json({ message: err.message, name: err.name, http_code: err.http_code });
  }
};

export const composePdfFromTag = async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ message: 'Missing tag' });
    const r = await cloudinary.uploader.multi(tag, { format: 'pdf' });
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const pdfUrl = `https://res.cloudinary.com/${cloud}/image/upload/${r.public_id}.pdf`;
    return res.status(200).json({ pdfPublicId: r.public_id, pdfUrl });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const listPages = async (req, res) => {
  try {
    const { filePublicId, tag, folder } = req.query;
    let expression = '';
    if (tag || filePublicId) {
      const t = tag || `pages:${filePublicId}`;
      expression = `tags=${t}`;
    } else if (folder) {
      expression = `folder=${folder}`;
    } else {
      return res.status(400).json({ message: 'Provide tag, filePublicId, or folder' });
    }

    const result = await cloudinary.search.expression(expression).sort_by('public_id','asc').max_results(100).execute();
    const items = (result.resources || []).map(r => ({
      public_id: r.public_id,
      url: r.secure_url,
      format: r.format,
      bytes: r.bytes,
      width: r.width,
      height: r.height,
    }));
    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
