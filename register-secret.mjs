import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import fs from "fs";

const response = await registerEntitySecretCiphertext({
  apiKey: 'TEST_API_KEY:5a839d9c6a0e8053f99d12f9aab70733:41ce360ef8633fe30b8f755de997847a',
  entitySecret: 'ba9b6280c7278421fae6d5b3c07de5212447581a4bcb6c774bdbf41e6c40e17b'
});

fs.writeFileSync('recovery_file.dat', response.data?.recoveryFile ?? '');

console.log('Entity secret registered successfully!');
console.log('Recovery file saved to: recovery_file.dat');
