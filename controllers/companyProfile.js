const CompanyProfile = require('../models/CompanyProfile');

exports.getProfile = async (req, res) => {
  try {
    let profile = await CompanyProfile.findOne();

    if (!profile) {
      return res.status(200).json({
        success: true,
        data: {
          companyName: '',
          gst: '',
          address: '',
          email: '',
          contact: '',
        },
      });
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { companyName, gst, address, email, contact, logo, stamp } = req.body;

    if (!companyName || !gst || !address || !email || !contact) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required',
      });
    }

    let profile = await CompanyProfile.findOne();

    if (!profile) {
      profile = new CompanyProfile({
        companyName,
        gst,
        address,
        email,
        contact,
        logo,
        stamp,
      });
    } else {
      profile.companyName = companyName;
      profile.gst = gst;
      profile.address = address;
      profile.email = email;
      profile.contact = contact;
      if (logo !== undefined) profile.logo = logo;
      if (stamp !== undefined) profile.stamp = stamp;
    }

    await profile.save();

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
