import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StudentService } from '../students/students.service';
import { StudentLoginDto } from './dto/student-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly studentService: StudentService,
  ) {}

  async studentLogin(loginDto: StudentLoginDto) {
    const { studentId, uniqueKey } = loginDto;

    if (!studentId && !uniqueKey) {
      throw new BadRequestException('Απαιτείται κωδικός μαθητή');
    }

    let student = null;

    if (studentId) {
      student = await this.studentService.findByStudentId(studentId);
      if (!student) {
        student = await this.studentService.findByUniqueKey(studentId);
      }
    } else if (uniqueKey) {
      student = await this.studentService.findByUniqueKey(uniqueKey);
    }

    if (!student) {
      throw new UnauthorizedException(
        'Μη έγκυρα στοιχεία. Ελέγξτε τον κωδικό μαθητή και δοκιμάστε ξανά.',
      );
    }

    const studentStatus = student.status || 'active';

    if (studentStatus !== 'active') {
      const statusMessages = {
        inactive: 'ανενεργός',
        suspended: 'ανασταλμένος',
        graduated: 'αποφοιτημένος',
      };
      const statusMessage = statusMessages[studentStatus] || 'μη διαθέσιμος';

      throw new UnauthorizedException(
        `Ο λογαριασμός σας είναι ${statusMessage}. Επικοινωνήστε με το φροντιστήριο.`,
      );
    }

    await this.studentService.updateLastLogin(student._id.toString());

    const token = this.jwtService.sign(
      {
        studentId: student._id,
        uniqueKey: student.uniqueKey,
        studentCode: student.studentId || null,
        type: 'student',
      },
      {
        expiresIn: '7d',
      },
    );

    const studentData = {
      _id: student._id,
      uniqueKey: student.uniqueKey,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      grade: student.grade,
      school: student.school,
      subjects: student.subjects,
      status: student.status,
      registrationDate: student.registrationDate,
      lastLogin: student.lastLogin,
      hasAccessToThemata: student.hasAccessToThemata || false,
    };

    return {
      success: true,
      message: 'Επιτυχής σύνδεση',
      student: studentData,
      token,
    };
  }

  async verifyStudentToken(token: string) {
    try {
      const decoded = await this.jwtService.verifyAsync(token);

      if (decoded.type !== 'student') {
        throw new UnauthorizedException('Invalid token type');
      }

      const student = await this.studentService.findById(decoded.studentId);

      if (!student) {
        throw new UnauthorizedException('Student not found');
      }

      if (student.status !== 'active') {
        throw new UnauthorizedException('Account is not active');
      }

      return {
        success: true,
        student: {
          _id: student._id,
          uniqueKey: student.uniqueKey,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          phone: student.phone,
          grade: student.grade,
          school: student.school,
          subjects: student.subjects,
          status: student.status,
          registrationDate: student.registrationDate,
          lastLogin: student.lastLogin,
          hasAccessToThemata: student.hasAccessToThemata || false,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

