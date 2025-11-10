import mongoose from 'mongoose';
import dotenv from 'dotenv';

import File from '../models/File.js';
import ProfessorValidator from '../models/ProfessorValidator.js';

dotenv.config();

/**
 * Small diagnostic utility that prints material verification gaps between
 * tagged professors and the professor validator collection.
 */
async function runReport() {
	try {
		await mongoose.connect(process.env.MONGODB_URI);
		console.log('✅ Connected to MongoDB');

		const [files, approvedProfessors] = await Promise.all([
			File.find({ 'taggedProfessors.0': { $exists: true } })
				.select('title taggedProfessors uploadedBy')
				.lean(),
			ProfessorValidator.find({ status: 'approved' })
				.select('_id fullName collegeName')
				.lean()
		]);

		const professorMap = new Map(
			approvedProfessors.map((prof) => [prof._id.toString(), prof])
		);

		const missingLinks = [];

		files.forEach((file) => {
			file.taggedProfessors.forEach((tag) => {
				const professorId = tag.professorId?.toString();
				if (!professorId || !professorMap.has(professorId)) {
					missingLinks.push({
						fileTitle: file.title,
						taggedProfessorId: professorId ?? '(missing)',
						taggedProfessorName: tag.professorName || '(unknown)',
						uploadedBy: file.uploadedBy || '(unknown)'
					});
				}
			});
		});

		if (missingLinks.length === 0) {
			console.log('\n✅ All tagged professors map to an approved professor record.');
		} else {
			console.log(`\n⚠️ Found ${missingLinks.length} tagged professor entries without a matching approval:`);
			missingLinks.forEach((entry, index) => {
				console.log(`  ${index + 1}. File: ${entry.fileTitle}`);
				console.log(`     Tagged professor: ${entry.taggedProfessorName}`);
				console.log(`     Professor ID: ${entry.taggedProfessorId}`);
				console.log(`     Uploaded by: ${entry.uploadedBy}`);
			});
		}

		console.log('\n✅ Report complete.');
		process.exit(0);
	} catch (error) {
		console.error('❌ Error running tagged professor check:', error);
		process.exit(1);
	}
}

runReport();
