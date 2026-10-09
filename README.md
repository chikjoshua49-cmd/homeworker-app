import 'package:flutter/material.dart';

class BookingListScreen extends StatelessWidget {
  const BookingListScreen({super.key});

  final List<Map<String, String>> bookings = const [
    {'title': 'Home cleaning', 'status': 'Accepted', 'date': '12 Oct 2026'},
    {'title': 'Repair work', 'status': 'Awaiting confirmation', 'date': '18 Oct 2026'},
  ];

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: bookings.length,
      itemBuilder: (context, index) {
        final booking = bookings[index];
        return Card(
          child: ListTile(
            title: Text(booking['title'] ?? 'Booking'),
            subtitle: Text(booking['date'] ?? 'Date'),
            trailing: Chip(
              label: Text(booking['status'] ?? 'Unknown'),
              backgroundColor: Colors.blue.shade50,
            ),
          ),
        );
      },
    );
  }
}
