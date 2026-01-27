/**
 * Create a test receptionist linked to an existing customer.
 * Run from backend/: node scripts/seedReceptionist.js <customerUsername> <name> <username> <email> <password> [y|n]
 * canBookMediaDay: y = true, n or omit = false.
 *
 * Example:
 *   node scripts/seedReceptionist.js acmeclinic "Jane Doe" jane.recep jane@example.com secret123 y
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const usage = `
Usage: node scripts/seedReceptionist.js <customerUsername> <name> <username> <email> <password> [canBookMediaDay]

  customerUsername  Username of an existing customer (role=customer) to link.
  name              Receptionist full name.
  username          Receptionist login username (must be unique).
  email             Receptionist email (must be unique).
  password          Receptionist password.
  canBookMediaDay   Optional: "y" or "n" (default: n). "y" allows Media Day booking.

Example:
  node scripts/seedReceptionist.js acmeclinic "Jane Doe" jane.recep jane@example.com secret123 y
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 5 || args[0] === '--help' || args[0] === '-h') {
    console.log(usage);
    process.exit(args[0] === '--help' || args[0] === '-h' ? 0 : 1);
  }

  const [customerUsername, name, username, email, password, canBookRaw] = args;
  const canBookMediaDay = (canBookRaw || 'n').toLowerCase() === 'y' || (canBookRaw || 'n').toLowerCase() === 'true';

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.\n');

    const parent = await User.findOne({ username: customerUsername, role: 'customer' });
    if (!parent) {
      console.error(`Customer not found with username: ${customerUsername} (role=customer).`);
      process.exit(1);
    }
    console.log(`Linking to customer: ${parent.name} (${parent.username}), _id=${parent._id}`);

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      console.error(`Username or email already in use: ${existing.username} / ${existing.email}`);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const receptionist = new User({
      name,
      username,
      email,
      password: hashedPassword,
      role: 'receptionist',
      parentCustomerId: parent._id,
      canBookMediaDay,
    });
    await receptionist.save();

    const out = await User.findById(receptionist._id).select('-password').lean();
    console.log('\nReceptionist created:');
    console.log(JSON.stringify(out, null, 2));
    console.log(`\nLogin with username: ${username}, password: <the one you passed>`);
    console.log(`Can book Media Day: ${canBookMediaDay}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
}

main();
